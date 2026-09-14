import type { DefaultTheme } from 'vitepress';

export const labTechExplorationSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '探索技术',
    items: [
      { text: '专题首页', link: '/lab-tech-exploration/' },
      {
        text: 'Java 与 JVM',
        collapsed: false,
        items: [
          {
            text: 'Quarkus 容器 RSS 持续增长：一次 JVM Heap 正常但 Native Memory 膨胀的问题排查',
            link: '/lab-tech-exploration/java-jvm/quarkus-container-rss-growth',
          },
          {
            text: '一个 4 年来从未生效的 JVM 参数：Docker 中 JAVA_OPTS 的误区',
            link: '/lab-tech-exploration/java-jvm/docker-java-opts-not-effective',
          },
          {
            text: 'Spring Boot 2.2 + Micrometer 中 JVM 指标消失：一次 MeterRegistry 提前初始化问题排查',
            link: '/lab-tech-exploration/java-jvm/spring-boot-micrometer-jvm-metrics-missing',
          },
        ],
      },
      {
        text: '应用框架',
        collapsed: false,
        items: [
          {
            text: '从 Spring Boot 迁移到 Quarkus：一份面向真实业务的基础能力验证清单',
            link: '/lab-tech-exploration/application-frameworks/spring-boot-to-quarkus-capability-validation',
          },
          {
            text: 'Spring Boot 2.7 YAML 国际化：一次从查不到合适方案到源码扩展点的探索',
            link: '/lab-tech-exploration/application-frameworks/spring-boot-2-7-yaml-i18n-source-extension',
          },
          {
            text: '从 JPA + MyBatis 到 MyBatis-Plus：一次旧项目数据访问层的维护性收敛',
            link: '/lab-tech-exploration/application-frameworks/jpa-mybatis-to-mybatis-plus-maintainability',
          },
          {
            text: '从 log4jdbc 到 p6spy：后来才意识到，我需要的不只是单行 SQL',
            link: '/lab-tech-exploration/application-frameworks/log4jdbc-to-p6spy-jdbc-observability',
          },
          {
            text: '一次 User-Agent 解析引发的内存与登录性能问题：从 YAUAA 缓存怀疑到删除无用功能',
            link: '/lab-tech-exploration/application-frameworks/yauaa-user-agent-memory-login-performance',
          },
          {
            text: 'PageHelper 两种分页写法对比：一次泛型失真的排查与源码分析',
            link: '/lab-tech-exploration/application-frameworks/pagehelper-pagination-generic-type-safety',
          },
          {
            text: 'Logback 的 debug.log 和 info.log 为什么几乎一样：一次旧项目多 root 配置排查',
            link: '/lab-tech-exploration/application-frameworks/logback-multiple-root-debug-info-log',
          },
          {
            text: '为什么我不再允许业务代码直接使用 MyBatis-Plus 的 insert 和 updateById',
            link: '/lab-tech-exploration/application-frameworks/avoid-mybatis-plus-insert-and-updatebyid-in-business-code',
          },
        ],
      },
      {
        text: '构建与依赖',
        collapsed: false,
        items: [
          {
            text: '从“一屏多看几个依赖”开始：一次 Maven POM 简化设计的历史探索',
            link: '/lab-tech-exploration/build-tools/maven-pom-simplification-history',
          },
        ],
      },
      {
        text: '数据库与中间件',
        collapsed: false,
        items: [],
      },
      {
        text: '容器与云环境',
        collapsed: false,
        items: [
          {
            text: 'Java 8 Alpine 容器中 jstack 与 Arthas 失败：一次 JVM 诊断能力补齐',
            link: '/lab-tech-exploration/containers-cloud/java8-alpine-jstack-arthas-diagnostics',
          },
          {
            text: '一次 Docker 基础镜像切换后的签名异常：从生产回滚到默认字符集',
            link: '/lab-tech-exploration/containers-cloud/docker-base-image-signature-default-charset',
          },
          {
            text: 'Dockerfile 写了 LANG=en_US.UTF-8，真的代表 Locale 生效了吗？',
            link: '/lab-tech-exploration/containers-cloud/alpine-lang-en-us-utf8-locale-validation',
          },
          {
            text: 'Docker 旧服务端口配置失真：一次 `--net=host` 环境下的排查与统一维护',
            link: '/lab-tech-exploration/containers-cloud/docker-old-service-port-config-drift',
          },
          {
            text: 'Docker 服务去除 --net=host：从 host 网络回到 bridge 的一次改造记录',
            link: '/lab-tech-exploration/containers-cloud/docker-remove-host-network',
          },
          {
            text: '从 SSL 证书过期到 CDN：一次 OSS 资源地址的来回调整',
            link: '/lab-tech-exploration/containers-cloud/oss-resource-url-design-after-ssl-expiration',
          },
        ],
      },
      {
        text: '网络与基础设施',
        collapsed: false,
        items: [
          {
            text: '一次 VPN 访问收紧导致支付回调中断的事故复盘',
            link: '/lab-tech-exploration/network-infrastructure/vpn-payment-callback-incident',
          },
          {
            text: 'HTTPS 证书申请失败排查：secondary validation DNS timeout',
            link: '/lab-tech-exploration/network-infrastructure/https-certificate-secondary-validation-dns-timeout',
          },
          {
            text: '微服务访问报 No route to host：一次 firewalld 端口未放行问题排查',
            link: '/lab-tech-exploration/network-infrastructure/microservice-no-route-to-host',
          },
        ],
      },
      {
        text: '安全',
        collapsed: false,
        items: [],
      },
      {
        text: '工程实践',
        collapsed: false,
        items: [
          {
            text: 'Windows 通过 SSH 隧道远程调试 Docker 中的 Spring Boot（JDWP）',
            link: '/lab-tech-exploration/engineering-practice/windows-ssh-tunnel-docker-spring-boot-jdwp',
          },
          {
            text: 'Spring Boot 单体应用中的接口安全边界设计',
            link: '/lab-tech-exploration/engineering-practice/spring-boot-api-security-boundary-design',
          },
          {
            text: '从请求头到可信 Token：一次跨模块租户上下文改造',
            link: '/lab-tech-exploration/engineering-practice/tenant-context-from-header-to-trusted-token',
          },
          {
            text: '什么时候该把文件处理接口改成异步任务',
            link: '/lab-tech-exploration/engineering-practice/async-file-processing-task',
          },
          {
            text: '别把所有测试都叫 Test：我如何用 UT、IT 和 SmokeIT 划分执行边界',
            link: '/lab-tech-exploration/engineering-practice/ut-it-smokeit-execution-boundary',
          },
          {
            text: 'Mapper 测试为什么只需要最小 Spring 上下文',
            link: '/lab-tech-exploration/engineering-practice/minimal-spring-context-for-mapper-tests',
          },
          {
            text: '如何编写可维护的上游渠道调用代码',
            link: '/lab-tech-exploration/engineering-practice/maintainable-upstream-channel-integration',
          },
          {
            text: '一个留学缴费遗留系统的治理：边界、验证与工程判断',
            link: '/lab-tech-exploration/engineering-practice/a-remit-system-governance',
          },
        ],
      },
    ],
  },
];
