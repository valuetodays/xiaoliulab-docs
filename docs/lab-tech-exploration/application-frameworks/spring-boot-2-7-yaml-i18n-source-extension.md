---
title: "Spring Boot 2.7 YAML 国际化：一次从查不到合适方案到源码扩展点的探索"
description: "记录 Spring Boot 2.7.18 项目实现 YAML 国际化语言包的真实探索过程：从网上没有找到合适方案，到调试 ReloadableResourceBundleMessageSource、追踪资源加载逻辑、放弃不需要的 reload 能力，最终通过 ResourceBundleMessageSource#doGetBundle 实现可缓存的 YAML MessageSource，并给出可还原的最小示例工程。"
keywords:
  - Spring Boot 2.7
  - 国际化
  - i18n
  - YAML
  - MessageSource
  - ResourceBundleMessageSource
  - ReloadableResourceBundleMessageSource
  - YamlPropertiesFactoryBean
---

# Spring Boot 2.7 YAML 国际化：一次从查不到合适方案到源码扩展点的探索

## 背景：我想把国际化语言包写成 YAML

项目使用：

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
    <relativePath/>
</parent>
```

Spring Boot 默认的国际化资源通常使用：

```text
messages.properties
messages_zh_CN.properties
messages_en_US.properties
```

但在这个项目里，我更希望语言包使用 YAML。

例如：

```yaml
i18n:
  auth:
    no_login: '请先登录'
  invalid_lang: '不支持的语言：{0}'
```

相比把所有 key 平铺在一个 Properties 文件里，YAML 的层级结构更容易阅读和整理。

需要说明的是，现代 Spring 项目完全可以使用 UTF-8 的 Properties，所以我选择 YAML 的主要原因并不是“Properties 不能写中文”，而是：

> YAML 的层级结构更适合维护数量不断增加的国际化文案。

最开始我以为这只是一个“换 YAML 解析器”的小问题。

后来才发现，真正麻烦的并不是怎么解析 YAML，而是：

> Spring 默认的 MessageSource 加载链路根本不会把 YAML 当成候选语言包。

## 先在网上找方案，但没有找到适合当前项目的实现

开始动手之前，我先搜索了 Spring Boot 使用 YAML 国际化语言包的做法。

当时没有找到一个可以直接套到当前项目、同时又符合这些要求的实现：

```text
Spring Boot 2.7.18
继续使用 Spring MessageSource
继续使用 spring.messages 配置
语言包使用 YAML
支持 zh_CN / en_US 这种 language_country 命名
语言包加载后继续使用 Spring 自己的缓存
```

这里更准确的说法是：

> 当时我没有找到适合当前项目的现成方案。

这并不代表互联网上绝对不存在类似实现，只是已有资料没有直接解决当前问题。

既然找不到，就只能自己往下摸。

## 先看 Spring Boot 默认的国际化实现

既然目标是让 Spring Boot 支持 YAML 语言包，第一步不是马上自己写 MessageSource，而是先看：

> Spring Boot 默认是怎么把 `messages.properties` 加载进来的？

从 `spring.messages` 配置入口往下看，可以找到 Spring Boot 的自动配置类：

```java
org.springframework.boot.autoconfigure.context.MessageSourceAutoConfiguration
```

配置属性由：

```java
org.springframework.boot.autoconfigure.context.MessageSourceProperties
```

承接。

也就是说：

```text
application.yml
    ↓
spring.messages.*
    ↓
MessageSourceProperties
    ↓
MessageSourceAutoConfiguration
    ↓
注册名为 messageSource 的 MessageSource
```

继续看 `MessageSourceAutoConfiguration`，可以看到 Spring Boot 并没有重新实现一套国际化框架，而是直接使用 Spring Framework 提供的 MessageSource 实现。

这一步很重要，因为它把问题从：

> Spring Boot 怎么支持 YAML？

收窄成了：

> Spring Framework 的 MessageSource 在哪里负责查找和加载资源？哪个扩展点最适合替换成 YAML？

## 从 MessageSource 的实现体系寻找扩展点

继续查看 Spring Framework 5.3.x 的 MessageSource 类型关系，可以看到主要继承结构：

```text
MessageSource
    ↑
HierarchicalMessageSource
    ↑
AbstractMessageSource
    ↑
AbstractResourceBasedMessageSource
       ├── ResourceBundleMessageSource
       └── ReloadableResourceBundleMessageSource
```

其中：

```java
ResourceBundleMessageSource
```

更接近 JDK `ResourceBundle` 的加载模型。

而：

```java
ReloadableResourceBundleMessageSource
```

则直接基于 Spring `Resource` 和 `Properties` 工作，并且提供了：

```java
loadProperties(...)
refreshProperties(...)
```

这类看起来可以参与资源加载过程的 protected 方法。

当时我的第一反应是：

```text
我要增加一种新的语言包文件格式
↓
YAML 最终也可以转成 Properties
↓
ReloadableResourceBundleMessageSource
本来就在做 Resource → Properties
↓
那是不是只需要重写 loadProperties()？
```

所以第一次尝试自然落到了 `ReloadableResourceBundleMessageSource`，而不是一开始就知道最终应该重写 `doGetBundle()`。

## 第一次尝试：继承 ReloadableResourceBundleMessageSource

第一版思路是：

```text
继承 ReloadableResourceBundleMessageSource
↓
重写 loadProperties()
↓
遇到 YAML 时使用 YamlPropertiesFactoryBean 解析
```

从当时看到的类设计来看，这条路很合理。

但真正运行以后，在 `loadProperties()` 上打断点却发现：

> 自己重写的方法根本没有被调用。

这时问题就从“怎么解析 YAML”变成了：

> Spring 在调用 `loadProperties()` 之前到底做了什么？

## 顺着 refreshProperties 往上调试

继续调试 `ReloadableResourceBundleMessageSource#refreshProperties` 后，才发现真正的问题发生得更早。

Spring Framework 5.3.x 这一代实现会按照它支持的资源后缀寻找文件，默认围绕：

```text
.properties
.xml
```

工作。

也就是说，如果把 basename 直接写成：

```text
i18n/messages.yml
```

Spring 并不会因为文件存在就自动把它交给 `loadProperties()`。

资源在更早的定位阶段就没有进入预期的加载链路。

这也解释了为什么最开始重写 `loadProperties()` 没有效果：

> 问题不是 YAML 解析代码没有执行，而是 YAML 文件根本没有走到这个扩展点。

这是整个排查过程里的第一个关键转折。

## 第二次尝试：那就重写 refreshProperties？

既然已经找到资源定位阶段，自然会想到：

> 能不能直接重写 `refreshProperties()`，自己完成 YAML 文件定位？

继续看源码后，又遇到了新的问题。

`ReloadableResourceBundleMessageSource` 的资源加载、缓存和刷新逻辑并不是一个孤立的方法，其中涉及父类内部维护的状态。

当时继续尝试扩展时，碰到了一些并不适合子类直接接管的内部成员，例如缓存状态和 ResourceLoader 等实现细节。

如果继续沿这条路硬改，就意味着需要把越来越多的 Spring 内部逻辑重新实现一遍：

```text
资源定位
缓存
刷新
并发访问
PropertiesHolder 生命周期
```

这已经明显偏离最初的需求。

而且如果自行绕开 Spring 原有缓存机制，实现不完整，还可能退化成重复解析语言包甚至重复 IO。

到这里，我开始重新问一个问题：

> 项目真的需要 ReloadableResourceBundleMessageSource 吗？

## 重新审视需求：其实我根本不需要 reload

重新把真实需求列出来以后，发现事情简单了很多。

项目只要求：

```text
messages_zh_CN.yml
messages_en_US.yml
```

也就是固定的：

```text
language_country
```

语言包修改以后，本来就会跟随应用重新发布。

因此根本没有“运行时修改 YAML 后自动刷新”的需求。

也就是说：

```text
需要 Locale 加载
需要 MessageSource
需要缓存
需要 YAML

但不需要 reload
```

既然不需要 reload，就没有必要继续为了 `ReloadableResourceBundleMessageSource` 的内部实现付出复杂度。

这成为第二个关键转折：

> 不是继续想办法攻破一个越来越难扩展的类，而是回到真实需求，重新寻找更小的扩展点。

## 转向 ResourceBundleMessageSource

继续看 Spring Boot 的 `MessageSourceAutoConfiguration` 和 Spring 的 MessageSource 实现后，注意到了：

```java
ResourceBundleMessageSource
```

它内部本来就负责：

```text
basename
Locale
ResourceBundle
MessageFormat
缓存
```

而且提供了一个很适合当前需求的 protected 扩展点：

```java
protected ResourceBundle doGetBundle(
        String basename,
        Locale locale)
```

问题一下变得清晰了。

Spring 继续负责：

```text
MessageSource API
Locale
basename
缓存
MessageFormat
```

我只负责：

```text
根据 basename + locale 找到 YAML
↓
解析 YAML
↓
包装成 ResourceBundle
```

这正好是当前需求需要扩展的那一小块。

## 最终实现思路

最终链路变成：

```text
messageSource.getMessage(...)
↓
ResourceBundleMessageSource
↓
doGetBundle(basename, locale)
↓
定位 messages_zh_CN.yml
↓
YamlPropertiesFactoryBean
↓
Properties
↓
YamlResourceBundle
↓
Spring MessageSource 缓存并返回文案
```

这里并没有重新实现一套国际化框架。

真正自定义的只有两个很小的东西：

```text
YamlResourceBundle
YamlResourceBundleMessageSource
```

另外再通过一个配置类，把它注册成 Spring 的 `messageSource` Bean。

## 最小可运行示例

下面把实际工程里的实现收缩成一个最小 Demo。

业务项目中的白名单、业务异常、语言枚举、启动检查等代码都没有放进来，只保留复现 YAML MessageSource 所必需的部分。

示例工程结构：

```text
yaml-i18n-demo/
├── pom.xml
└── src/
    └── main/
        ├── java/
        │   └── com/example/yamli18n/
        │       ├── DemoApplication.java
        │       ├── config/
        │       │   └── I18nConfig.java
        │       ├── controller/
        │       │   └── I18nController.java
        │       └── i18n/
        │           ├── XLangLocaleResolver.java
        │           ├── YamlResourceBundle.java
        │           └── YamlResourceBundleMessageSource.java
        └── resources/
            ├── application.yml
            └── i18n/
                ├── messages_en_US.yml
                └── messages_zh_CN.yml
```

### pom.xml

```xml
<!-- 文件：pom.xml -->
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">

    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.7.18</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>yaml-i18n-demo</artifactId>
    <version>1.0.0</version>

    <properties>
        <java.version>8</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>

</project>
```

不需要为了 YAML 再额外引入第三方解析库。

Spring Framework 已经提供：

```java
YamlPropertiesFactoryBean
```

可以直接把 YAML 转成 `Properties`。

### DemoApplication.java

```java
// 文件：src/main/java/com/example/yamli18n/DemoApplication.java
package com.example.yamli18n;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

### YamlResourceBundle.java

`ResourceBundleMessageSource` 最终使用的是 Java `ResourceBundle`。

因此先做一个很薄的包装，把 YAML 转换后的 `Properties` 放进 `ResourceBundle`：

```java
// 文件：src/main/java/com/example/yamli18n/i18n/YamlResourceBundle.java
package com.example.yamli18n.i18n;

import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.ResourceBundle;

public class YamlResourceBundle extends ResourceBundle {

    private final Map<String, Object> metadata = new HashMap<>();

    public YamlResourceBundle(Properties properties) {
        properties.forEach(
                (key, value) -> metadata.put(String.valueOf(key), value)
        );
    }

    @Override
    protected Object handleGetObject(String key) {
        return metadata.get(key);
    }

    @Override
    public Enumeration<String> getKeys() {
        return Collections.enumeration(metadata.keySet());
    }
}
```

例如 YAML：

```yaml
i18n:
  auth:
    no_login: '请先登录'
```

经过 `YamlPropertiesFactoryBean` 后会形成类似：

```properties
i18n.auth.no_login=请先登录
```

因此仍然可以按照 Spring MessageSource 熟悉的点号 key 来访问。

### YamlResourceBundleMessageSource.java

这是整个实现的核心。

```java
// 文件：src/main/java/com/example/yamli18n/i18n/YamlResourceBundleMessageSource.java
package com.example.yamli18n.i18n;

import java.util.Locale;
import java.util.MissingResourceException;
import java.util.Properties;
import java.util.ResourceBundle;

import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

public class YamlResourceBundleMessageSource
        extends ResourceBundleMessageSource {

    private static final String YML_SUFFIX = ".yml";
    private static final String YAML_SUFFIX = ".yaml";

    @Override
    protected ResourceBundle doGetBundle(
            String basename,
            Locale locale) throws MissingResourceException {

        String fullPath = buildResourcePath(basename, locale);

        Resource resource = findYamlResource(fullPath);
        if (resource == null) {
            // YAML 不存在时继续保留父类的 properties/xml 处理能力。
            return super.doGetBundle(basename, locale);
        }

        YamlPropertiesFactoryBean factory =
                new YamlPropertiesFactoryBean();
        factory.setResources(resource);
        factory.afterPropertiesSet();

        Properties properties = factory.getObject();
        if (properties == null) {
            return super.doGetBundle(basename, locale);
        }

        return new YamlResourceBundle(properties);
    }

    private String buildResourcePath(
            String basename,
            Locale locale) {

        String language = locale.getLanguage();
        String country = locale.getCountry();

        StringBuilder path = new StringBuilder(basename);

        if (!language.isEmpty()) {
            path.append("_").append(language);

            if (!country.isEmpty()) {
                path.append("_").append(country);
            }
        }

        return path.toString();
    }

    private Resource findYamlResource(String path) {

        Resource resource =
                new ClassPathResource(path + YML_SUFFIX);

        if (resource.exists()) {
            return resource;
        }

        resource =
                new ClassPathResource(path + YAML_SUFFIX);

        if (resource.exists()) {
            return resource;
        }

        return null;
    }
}
```

这里支持：

```text
.yml
.yaml
```

但没有为了兼容各种大小写后缀增加额外逻辑。

项目直接约定统一使用小写后缀即可。

### I18nConfig.java

实际项目并没有重新发明一套 YAML 国际化配置，而是继续复用 Spring Boot 原来的：

```text
spring.messages
```

配置类也参考了 Spring Boot 的：

```java
MessageSourceAutoConfiguration
```

最小实现如下：

```java
// 文件：src/main/java/com/example/yamli18n/config/I18nConfig.java
package com.example.yamli18n.config;

import java.time.Duration;
import java.util.Locale;

import com.example.yamli18n.i18n.XLangLocaleResolver;
import com.example.yamli18n.i18n.YamlResourceBundleMessageSource;
import org.springframework.boot.autoconfigure.context.MessageSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.AbstractApplicationContext;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.LocaleResolver;

@Configuration
public class I18nConfig {

    @Bean
    public LocaleResolver localeResolver() {
        XLangLocaleResolver resolver =
                new XLangLocaleResolver();
        resolver.setDefaultLocale(Locale.US);
        return resolver;
    }

    @Bean
    @ConfigurationProperties(prefix = "spring.messages")
    public MessageSourceProperties messageSourceProperties() {
        return new MessageSourceProperties();
    }

    /**
     * 配置方式参考：
     * org.springframework.boot.autoconfigure.context.MessageSourceAutoConfiguration
     */
    @Bean(AbstractApplicationContext.MESSAGE_SOURCE_BEAN_NAME)
    public MessageSource messageSource(
            MessageSourceProperties properties) {

        YamlResourceBundleMessageSource messageSource =
                new YamlResourceBundleMessageSource();

        if (StringUtils.hasText(properties.getBasename())) {
            messageSource.setBasenames(
                    StringUtils.commaDelimitedListToStringArray(
                            StringUtils.trimAllWhitespace(
                                    properties.getBasename()
                            )
                    )
            );
        }

        if (properties.getEncoding() != null) {
            messageSource.setDefaultEncoding(
                    properties.getEncoding().name()
            );
        }

        messageSource.setFallbackToSystemLocale(
                properties.isFallbackToSystemLocale()
        );

        Duration cacheDuration = properties.getCacheDuration();
        if (cacheDuration != null) {
            messageSource.setCacheMillis(
                    cacheDuration.toMillis()
            );
        }

        messageSource.setAlwaysUseMessageFormat(
                properties.isAlwaysUseMessageFormat()
        );

        messageSource.setUseCodeAsDefaultMessage(
                properties.isUseCodeAsDefaultMessage()
        );

        return messageSource;
    }
}
```

这样应用仍然使用熟悉的 Spring Boot 配置项，而不是增加：

```text
custom.i18n.xxx
yaml.message.xxx
```

之类的另一套配置体系。

### XLangLocaleResolver.java

实际项目通过请求头 `X-Lang` 传递语言。

最小 Demo 保留这一行为，但去掉业务项目中的白名单、业务异常和语言枚举：

```java
// 文件：src/main/java/com/example/yamli18n/i18n/XLangLocaleResolver.java
package com.example.yamli18n.i18n;

import java.util.Locale;
import javax.servlet.http.HttpServletRequest;

import org.springframework.util.StringUtils;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

public class XLangLocaleResolver
        extends AcceptHeaderLocaleResolver {

    private static final String LANG_HEADER = "X-Lang";

    @Override
    public Locale resolveLocale(HttpServletRequest request) {

        String lang = request.getHeader(LANG_HEADER);

        if (!StringUtils.hasText(lang)) {
            Locale defaultLocale = getDefaultLocale();
            return defaultLocale != null
                    ? defaultLocale
                    : Locale.US;
        }

        // 同时接受 zh_CN / en_US 和 zh-CN / en-US。
        String normalized = lang.replace("_", "-");

        return Locale.forLanguageTag(normalized);
    }
}
```

例如：

```text
X-Lang: zh_CN
```

会得到：

```text
Locale = zh_CN
```

然后由自定义 MessageSource 查找：

```text
i18n/messages_zh_CN.yml
```

### application.yml

```yaml
# 文件：src/main/resources/application.yml
spring:
  messages:
    basename: i18n/messages
    encoding: UTF-8
    fallback-to-system-locale: false
```

实际项目可以配置多个 basename，例如：

```yaml
spring:
  messages:
    basename: i18n/messages,i18n/common,i18n/validation,i18n/biz_error_msg
```

这部分能力仍然来自 Spring 的 `MessageSourceProperties`，自定义 YAML MessageSource 不需要重新实现。

### messages_zh_CN.yml

```yaml
# 文件：src/main/resources/i18n/messages_zh_CN.yml
i18n:
  hello: '你好'
  welcome: '欢迎，{0}'
  auth:
    no_login: '请先登录'
  invalid_lang: '不支持的语言：{0}'
```

### messages_en_US.yml

```yaml
# 文件：src/main/resources/i18n/messages_en_US.yml
i18n:
  hello: 'Hello'
  welcome: 'Welcome, {0}'
  auth:
    no_login: 'Please login first'
  invalid_lang: 'Unsupported language: {0}'
```

### I18nController.java

最后增加一个最小接口验证整个链路：

```java
// 文件：src/main/java/com/example/yamli18n/controller/I18nController.java
package com.example.yamli18n.controller;

import java.util.Locale;

import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class I18nController {

    private final MessageSource messageSource;

    public I18nController(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    @GetMapping("/i18n/hello")
    public String hello() {

        Locale locale = LocaleContextHolder.getLocale();

        return messageSource.getMessage(
                "i18n.hello",
                null,
                locale
        );
    }

    @GetMapping("/i18n/welcome")
    public String welcome() {

        Locale locale = LocaleContextHolder.getLocale();

        return messageSource.getMessage(
                "i18n.welcome",
                new Object[]{"Josh"},
                locale
        );
    }
}
```

## 运行验证

启动：

```bash
mvn spring-boot:run
```

请求中文：

```bash
curl \
  -H 'X-Lang: zh_CN' \
  http://localhost:8080/i18n/hello
```

返回：

```text
你好
```

请求英文：

```bash
curl \
  -H 'X-Lang: en_US' \
  http://localhost:8080/i18n/hello
```

返回：

```text
Hello
```

测试带参数的文案：

```bash
curl \
  -H 'X-Lang: zh_CN' \
  http://localhost:8080/i18n/welcome
```

返回：

```text
欢迎，Josh
```

到这里，一个没有额外第三方 YAML 国际化依赖的 Spring Boot 2.7.18 示例工程就可以完整跑起来。

## 关于缓存：不会每次请求都重新解析 YAML

最终选择 `ResourceBundleMessageSource` 还有一个重要原因：不需要自己重新实现 MessageSource 的缓存体系。

`doGetBundle()` 是 ResourceBundle 的实际加载扩展点，但上层仍然由 `ResourceBundleMessageSource` 管理缓存。

因此在默认缓存策略下，同一个：

```text
basename + Locale
```

加载成功以后，会进入 MessageSource 自己维护的 ResourceBundle 缓存。

也就是说，并不是：

```text
每次 getMessage()
↓
读取 YAML
↓
重新解析
```

而是第一次需要某个语言包时完成加载，之后继续复用缓存结果。

这也是为什么我最终没有选择完全自己实现一个 MessageSource。

我只想改变：

> 语言包从哪里来、怎么转换成 ResourceBundle。

而不想重新实现 Spring 已经解决好的：

```text
缓存
MessageFormat
basename
Locale
```

## 实现边界：只支持当前项目真正需要的能力

这套实现并不是试图完整重写 Java `ResourceBundle` 的所有规则。

当前项目明确只支持：

```text
language_country
```

例如：

```text
zh_CN
en_US
```

所以对应语言包就是：

```text
messages_zh_CN.yml
messages_en_US.yml
```

没有实现完整的 candidate locale fallback，例如：

```text
zh_CN_VARIANT
zh_CN
zh
base
```

也没有运行时 reload。

这是有意的能力边界，而不是遗漏。

因为项目真正需要的是：

```text
language_country
+
应用启动后的稳定缓存
```

语言包发生变化时重新发布应用即可。

如果未来需求变成：

```text
语言包运行时修改
无需重启立即生效
完整 Locale fallback
外部目录动态加载
```

那就应该重新评估实现，而不是继续把当前这个简单类不断扩张。

## 回头看：真正的突破不是写出了 YAML 解析代码

重新回顾这次过程，真正困难的部分并不是：

```java
YamlPropertiesFactoryBean
```

怎么使用。

真正花时间的是找到：

> 到底应该在 Spring 的哪一层扩展。

探索过程大致经历了：

```text
网上查资料，没有找到适合当前需求的方案
↓
继承 ReloadableResourceBundleMessageSource
↓
重写 loadProperties()
↓
打断点发现没有进入
↓
继续调试 refreshProperties()
↓
发现 YAML 在资源定位阶段就已经被排除
↓
尝试继续扩展 refreshProperties()
↓
碰到内部缓存和资源加载实现
↓
重新审视真实需求
↓
发现项目根本不需要 reload
↓
转向 ResourceBundleMessageSource
↓
发现 doGetBundle() 正好是所需扩展点
↓
YamlPropertiesFactoryBean 转 Properties
↓
包装成 ResourceBundle
↓
最终跑通
```

一开始没有一个可以直接照抄的答案。

最后却能顺着调试、源码和一次次失败，把整个加载链路摸清楚，并找到一个最终很小的实现。

这也是这次最有成就感的地方。

## 这次探索留下的经验

这次经历给我的一个很直接的启发是：

> 当框架没有直接提供想要的功能时，不要一开始就试图重写大量内部逻辑，先沿调用链找到问题真正发生在哪一层。

第一次尝试失败时，表面现象是：

```text
loadProperties() 不执行
```

如果停在这里，很容易继续想办法“强行让它执行”。

真正有效的是继续追问：

```text
为什么不执行？
是谁决定资源文件名？
缓存在哪一层？
项目真正需要 reload 吗？
有没有更小的 protected 扩展点？
```

最后发现：

> 需要改变的并不是整个 MessageSource，只是 ResourceBundle 的来源。

于是实现从“可能需要重写大量 Spring 内部逻辑”，收敛成了两个很小的类。

这比最终支持 YAML 本身更值得记录。

## 版本说明

本文基于：

```text
Spring Boot 2.7.18
Spring Framework 5.3.x
```

讨论的是这一代 Spring Framework 下 `ReloadableResourceBundleMessageSource` 的实际行为。

不同 Spring Framework 版本的资源扩展能力可能已经发生变化，因此如果在更新版本上实现同样需求，应该先重新检查当前版本源码和公开扩展点，不要机械复制本文方案。

## 参考

- Spring Boot `MessageSourceAutoConfiguration`
- Spring Framework `ReloadableResourceBundleMessageSource`
- Spring Framework `ResourceBundleMessageSource`
- Spring Framework `YamlPropertiesFactoryBean`
