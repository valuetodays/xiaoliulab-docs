## Fonts

本项目统一使用 Google 官方 Noto CJK 字体。

版本：

- Noto CJK 2.004

官方下载：

https://github.com/notofonts/noto-cjk/releases/tag/Serif2.003

下载“Static Super OTC”

安装：

Windows：
右键安装 TTC。

Ubuntu：

### 当前用户

```shell
mkdir -p ~/.local/share/fonts

cp NotoSansCJK.ttc ~/.local/share/fonts/
cp NotoSerifCJK.ttc ~/.local/share/fonts/

fc-cache -fv
```

验证

```shell
fc-list | grep "Noto Sans CJK"
fc-list | grep "Noto Serif CJK"


fc-match "Noto Sans CJK SC"
fc-match "Noto Serif CJK SC"
```

### 所有用户

```shell
sudo mkdir -p /usr/local/share/fonts/noto

sudo cp NotoSansCJK.ttc /usr/local/share/fonts/noto/
sudo cp NotoSerifCJK.ttc /usr/local/share/fonts/noto/

sudo fc-cache -fv
```

验证

```shell
fc-list | grep "Noto Sans CJK"
fc-list | grep "Noto Serif CJK"


fc-match "Noto Sans CJK SC"
fc-match "Noto Serif CJK SC"
```

