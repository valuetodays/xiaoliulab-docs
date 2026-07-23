---
title: TdxQuant 前复权行情随查询结束日期变化的踩坑记录
description: 记录 TdxQuant 前复权行情受查询结束日期影响的问题，说明复现方法、数据风险与保持复权口径一致的处理方式。
head:
  - - meta
    - name: keywords
      content: TdxQuant,前复权,end_time,get_market_data,历史行情,通达信,ETF份额拆分
---

# TdxQuant 前复权行情随查询结束日期变化的踩坑记录

> **一句话结论**
>
> TdxQuant 的前复权价格会受到本次查询范围（尤其 end_time）的影响，因此不同时间段查询得到的历史价格可能不同。需要获取完整历史后，再在调用方过滤日期，才能保证复权口径一致。

## 问题概览

### 问题背景

本工程通过 TdxQuant 获取股票和 ETF 的历史行情，并使用通达信公式系统计算 CCI 等技术指标。

在对比 TdxQuant 与 QMT Mini 的前复权行情时，发现同一个品种、同一个历史交易日，仅仅改变 `get_market_data` 的 `end_time`，返回的前复权 OHLC 就可能不同。

这不一定是行情数据错误，而是前复权基准与本次查询所包含的 K 线范围有关。这个差异对发生过分红、送转或基金份额拆分的品种尤其明显。

本文使用 `512890.SH` 复现。该 ETF 在 2021 年 10 月进行过 `1:2` 份额拆分，因此拆分前后的价格差异非常直观。


### 适用范围

本文结论适用于：

- TdxQuant
- 日线（1d）
- 前复权模式：`dividend_type="front"`

暂未验证：

- 后复权
- 不复权
- 分钟线
- Tick


### 问题现象

以下两个请求具有相同的开始日期，但结束日期不同：

```python
# 请求结束于份额拆分之前
start_time = "20210901"
end_time = "20210930"

# 请求跨过份额拆分日期
start_time = "20210901"
end_time = "20211231"
```

两次请求都使用：

```python
dividend_type = "front"
count = -1
```

正常情况下容易直觉地认为：两次结果中 2021 年 9 月的重叠行情应该完全相同。但实际测试中，第一批数据的价格大约是第二批数据的两倍。

因此，不能将多个不同 `end_time` 请求得到的前复权行情直接拼接成一条连续历史行情。

### 影响

如果不了解该行为，可能导致：

- 历史行情重复下载后无法直接覆盖
- 不同时间下载的数据拼接错误
- 技术指标历史值发生变化
- 回测结果前后不一致
- 历史行情重复同步时可能覆盖为不同复权口径的数据

## 复现与验证

### 复现环境

- Windows Server 2022 Datacenter
  - WindowsVersion：2009
  - OS Build：20348
  - 平台标识：`Windows-2022Server-10.0.20348-SP0`
- 通达信金融终端 V7.73 64 位
- Python 3.12.7 64 位
  - 构建：`tags/v3.12.7:0b05ead, Oct 1 2024, 03:06:41`
  - 编译器：`MSC v.1941 64 bit (AMD64)`
- 已安装并启动支持 TQ 策略的通达信客户端
- 通达信客户端已经登录
- TdxQuant 可以正常初始化
- Python 可以导入 `tqcenter`
- 本次 TdxQuant Python 模块目录为 `C:\new_tdx64\PYPlugins\user`
- 实际加载模块为 `C:\new_tdx64\PYPlugins\user\tqcenter.py`
- 已下载或能够刷新 `512890.SH` 的日线行情

本文代码可以直接连接本机 TdxQuant 执行。

### 最小复现代码

将下面的完整代码保存为：

```text
tdxquant_front_adjustment_check.py
```

代码不会修改行情或交易数据，只会刷新日线缓存、查询行情并把比较结果输出到控制台。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import platform
import sys
from typing import Any

# tqcenter.py 位于通达信安装目录中，不属于普通的 pip 依赖。
# 如果通达信安装在其他位置，需要修改这里的路径。
TDX_USER_PATH = r"C:\new_tdx64\PYPlugins\user"
sys.path.insert(0, TDX_USER_PATH)

import tqcenter
from tqcenter import tq


STOCK_CODE = "512890.SH"
PERIOD = "1d"
FIELDS = ["Open", "High", "Low", "Close", "Volume", "Amount"]

# 该区间位于 2021 年 10 月份额拆分之前。
OVERLAP_START = "20210901"
OVERLAP_END = "20210930"

# 第一个请求结束于拆分前，第二个请求结束于拆分后。
SHORT_END = "20210930"
LONG_END = "20211231"


def parse_result(value: Any) -> Any:
    """兼容 TdxQuant 返回 dict 或 JSON 字符串的情况。"""
    if isinstance(value, str):
        return json.loads(value)
    return value


def compact_date(value: Any) -> int:
    """将 DataFrame 索引转换成 YYYYMMDD 整数。"""
    if hasattr(value, "strftime"):
        return int(value.strftime("%Y%m%d"))

    digits = "".join(character for character in str(value) if character.isdigit())
    if len(digits) < 8:
        raise ValueError(f"无法识别行情日期：{value!r}")
    return int(digits[:8])


def get_front_data(start_time: str, end_time: str) -> dict:
    """直接调用 TdxQuant 获取前复权日线。"""
    return tq.get_market_data(
        field_list=FIELDS,
        stock_list=[STOCK_CODE],
        period=PERIOD,
        start_time=start_time,
        end_time=end_time,
        count=-1,
        dividend_type="front",
        fill_data=True,
    )


def to_rows(data: dict) -> dict[int, dict[str, float]]:
    """将 TdxQuant 的字段 DataFrame 结构转换成按日期索引的字典。"""
    rows: dict[int, dict[str, float]] = {}

    for field in FIELDS:
        frame = data.get(field)
        if frame is None or STOCK_CODE not in frame.columns:
            continue

        for index, value in frame[STOCK_CODE].items():
            date_value = compact_date(index)
            rows.setdefault(date_value, {})[field.lower()] = float(value)

    return rows


def filter_rows(
    rows: dict[int, dict[str, float]],
    start_time: str,
    end_time: str,
) -> dict[int, dict[str, float]]:
    """在 Python 中筛选日期，不再让 DLL 用日期裁剪前复权数据。"""
    start_date = int(start_time) if start_time else None
    end_date = int(end_time) if end_time else None

    return {
        date_value: values
        for date_value, values in rows.items()
        if (start_date is None or date_value >= start_date)
        and (end_date is None or date_value <= end_date)
    }


def compare_close(
    title: str,
    left: dict[int, dict[str, float]],
    right: dict[int, dict[str, float]],
) -> None:
    """比较两组行情重叠日期的收盘价。"""
    common_dates = sorted(set(left) & set(right))
    changed_count = 0
    max_difference = 0.0

    print()
    print(title)
    print("date       left_close    right_close   difference")

    for date_value in common_dates:
        left_close = left[date_value].get("close")
        right_close = right[date_value].get("close")
        if left_close is None or right_close is None:
            continue

        difference = left_close - right_close
        if abs(difference) > 1e-12:
            changed_count += 1
        max_difference = max(max_difference, abs(difference))

        print(
            f"{date_value}  "
            f"{left_close:>12.6f}  "
            f"{right_close:>13.6f}  "
            f"{difference:>11.6f}"
        )

    print(
        "summary:",
        json.dumps(
            {
                "common_dates": len(common_dates),
                "changed_dates": changed_count,
                "max_abs_difference": max_difference,
            },
            ensure_ascii=False,
        ),
    )


def main() -> None:
    tq.initialize(__file__)
    try:
        print("python_version:", sys.version.replace("\n", " "))
        print("python_architecture:", platform.architecture())
        print("windows_platform:", platform.platform())
        print("tqcenter_path:", tqcenter.__file__)

        refresh_result = parse_result(
            tq.refresh_kline(stock_list=[STOCK_CODE], period=PERIOD)
        )
        print("refresh_kline:", refresh_result)

        # 问题复现：只改变 end_time，比较相同的 2021 年 9 月行情。
        bounded_before_split = filter_rows(
            to_rows(get_front_data(OVERLAP_START, SHORT_END)),
            OVERLAP_START,
            OVERLAP_END,
        )
        bounded_after_split = filter_rows(
            to_rows(get_front_data(OVERLAP_START, LONG_END)),
            OVERLAP_START,
            OVERLAP_END,
        )
        compare_close(
            "[问题复现] 相同历史日期，不同 end_time 的前复权收盘价",
            bounded_before_split,
            bounded_after_split,
        )

        # 当前解决方案：让 TdxQuant 基于完整日线计算前复权价格，
        # 然后只在 Python 中筛选调用方需要的日期。
        complete_front_rows = to_rows(get_front_data("", ""))
        solution_short = filter_rows(
            complete_front_rows,
            OVERLAP_START,
            SHORT_END,
        )
        solution_long = filter_rows(
            complete_front_rows,
            OVERLAP_START,
            LONG_END,
        )
        solution_long_overlap = filter_rows(
            solution_long,
            OVERLAP_START,
            OVERLAP_END,
        )
        compare_close(
            "[解决方案验证] 完整历史只查询一次，再用 Python 分别筛选",
            solution_short,
            solution_long_overlap,
        )

        print()
        print("完整日线数量：", len(complete_front_rows))
        if complete_front_rows:
            complete_dates = sorted(complete_front_rows)
            print("完整日线开始日期：", complete_dates[0])
            print("完整日线结束日期：", complete_dates[-1])
        print("请将以上全部控制台输出反馈给分析人员。")
    finally:
        close = getattr(tq, "close", None)
        if callable(close):
            close()


if __name__ == "__main__":
    main()
```

### 执行方法

1. 启动并登录通达信客户端。
2. 确认 TdxQuant 插件处于可用状态。
3. 确认脚本中的 `TDX_USER_PATH` 与实际通达信安装路径一致。
4. 打开 PowerShell 或命令提示符。
5. 使用 Python 执行：

```powershell
python tdxquant_front_adjustment_check.py
```

如果机器上使用 `python3`：

```powershell
python3 tdxquant_front_adjustment_check.py
```

如果希望中文输出不乱码，可以先将控制台切换为 UTF-8：

```powershell
chcp 65001
$env:PYTHONUTF8 = "1"
python tdxquant_front_adjustment_check.py
```

请保留完整输出，特别是两段 `summary` 和“完整日线数量”。

### 预期结果与实际结果

第一段比较用于复现问题：

```text
[问题复现] 相同历史日期，不同 end_time 的前复权收盘价
```

预期会看到多个重叠日期的价格不同：

```json
{"common_dates": 20, "changed_dates": 20, "max_abs_difference": ...}
```

具体交易日数量和价格以实际 TdxQuant 版本返回为准。

第二段比较用于验证当前解决方案：

```text
[解决方案验证] 完整历史只查询一次，再用 Python 分别筛选
```

预期所有重叠日期完全一致：

```json
{"common_dates": 20, "changed_dates": 0, "max_abs_difference": 0.0}
```

本次在 Windows Server 2022 Datacenter（Build 20348）、通达信金融终端
V7.73 64 位和 Python 3.12.7 64 位环境中的实际执行结果为：

```text
refresh_kline: {'ErrorId': '0', 'Msg': 'refresh kline cache success.', 'run_id': '1'}

[问题复现]
common_dates: 20
changed_dates: 20
max_abs_difference: 0.8859999999999999

[解决方案验证]
common_dates: 20
changed_dates: 0
max_abs_difference: 0.0

完整日线数量: 1820
```

问题组的价格关系非常明确。例如：

```text
date       end=20210930   end=20211231
20210901        1.588          0.794
20210909        1.744          0.872
20210930        1.658          0.829
```

第一组价格基本是第二组的两倍，与 `512890.SH` 的 `1:2` 份额拆分相符。个别日期相差 `0.001`，来自三位小数价格的舍入差异。

这次实测同时证明：完整历史只查询一次后，在 Python 中以不同结束日期筛选，重叠区间可以保持逐项完全一致。

## 原因与解决方案

### 原因分析

`dividend_type="front"` 并不意味着任意查询范围都会返回同一套固定历史价格。

从实际结果看，TdxQuant 会根据本次 `get_market_data` 返回的数据范围处理前复权。当 `end_time` 位于除权事件之前时，请求中看不到后续除权事件；当 `end_time` 跨过除权事件后，除权事件会影响此前的历史价格。

因此，下面两组数据虽然都是“前复权”，但它们的复权基准可能不同：

```text
2019-01-01 ～ 2020-12-31
2021-01-01 ～ 2021-12-31
```

直接按年或按月请求再拼接，会产生一条复权基准不一致的伪连续行情。

TdxQuant 官方说明也提到：要取得与客户端加载全部 K 线时一致的某日前复权数据，需要获取全部 K 线。另一个相关限制是，单次接口最多返回 24000 条数据。

- [TdxQuant 个别日期 OHLC 与客户端不一致的说明](https://help.tdx.com.cn/quant/docs/markdown/mindoc-tdxpy.html)
- [TdxQuant get_market_data 文档](https://help.tdx.com.cn/quant/docs/markdown/mindoc-1ctuhthaq5qmg/mindoc-1h10g60jt68sc.html)

### 短期工程方案

对于前复权日线，调用 TdxQuant 时不传查询边界：

```python
data = tq.get_market_data(
    field_list=["Open", "High", "Low", "Close", "Volume", "Amount"],
    stock_list=["512890.SH"],
    period="1d",
    start_time="",
    end_time="",
    count=-1,
    dividend_type="front",
    fill_data=True,
)
```

得到完整历史后，再由本工程按照用户请求的 `begin_date` 和 `end_date` 过滤。

需要特别注意：过滤必须发生在 TdxQuant 返回完整前复权数据之后，不能把用户请求日期继续传给 DLL。

### 工程实现方案

modestep 当前采用以下规则：

1. `period == "1d"` 时，TdxQuant 固定接收空的 `start_time` 和 `end_time`。
2. `count=-1`，获取该品种完整前复权日线。
3. 将 TdxQuant DataFrame 转换成统一行情结构。
4. 在 Python 中使用调用方原始日期范围过滤。
5. 分钟线及其他周期仍然把日期范围传给 TdxQuant。

只对日线这样处理，是因为分钟线很容易超过 24000 条，不能全量获取。

### 方案限制

1. TdxQuant 当前单次最多返回 24000 条数据。
2. 24000 条日线约等于 96 年交易数据，当前 A 股和 ETF 历史尚未达到该限制。
3. 每次获取完整日线比短区间请求占用更多时间和内存。
4. 该方案只保证同一时点查询得到统一前复权基准；未来发生新的分红或拆分后，历史前复权价格仍可能整体更新，这是前复权本身的正常性质。
5. 对外行情结构目前可能将 ETF 价格限制为三位小数，不能用它精确复现 TdxQuant 公式系统内部的高精度指标。
6. 不应把该方案直接用于完整分钟线。

### 长期改进建议

长期建立本地行情库时，不建议只保存前复权价格。更稳定的数据结构是：

```text
不复权 OHLC + 成交量 + 成交额 + ForwardFactor
```

原因如下：

- 不复权行情不会因为查询结束日期不同而变化，可以安全分段下载和拼接。
- TdxQuant 在 `dividend_type="none"` 时返回有效的 `ForwardFactor`。
- 使用统一锚点和复权因子，可以在查询阶段生成统一口径的前复权行情。
- 新发生除权事件时主要更新复权因子，不必重新下载全部原始行情。

正式实现前，需要用多个发生过现金分红、送转和 ETF 份额拆分的品种验证 TdxQuant `ForwardFactor` 的方向、精度及计算规则，不能未经验证直接硬编码公式。

## 总结与反馈

### 本次踩坑总结

不要认为：

> 相同日期的前复权价格一定相同。

真正决定历史价格的，不只是日期，还有：

- 查询结束日期
- 查询包含的除权事件
- 当前复权基准

### 结果反馈格式

执行复现代码后，建议反馈以下内容：

```text
通达信客户端版本：
TdxQuant 版本：
Python 版本：
操作系统版本：

refresh_kline 输出：

[问题复现] 完整输出：

[解决方案验证] 完整输出：

完整日线数量：
```

### 给官方的反馈模板

如果后续需要向通达信官方反馈，可以复制并补充下面的内容：

```text
标题：TdxQuant get_market_data 前复权结果随 end_time 变化

环境：
- 通达信客户端版本：
- TdxQuant 版本：
- Python 版本：
- 操作系统：

品种：512890.SH
周期：1d
复权方式：front

现象：
使用相同 start_time、不同 end_time 调用 get_market_data 时，两次结果中
相同历史日期的前复权 OHLC 不一致。测试品种 512890.SH 在 2021 年 10 月
发生过 1:2 份额拆分，结束日期位于拆分前后时差异明显。

影响：
调用方无法将多个短区间前复权请求安全拼接；为了与客户端完整历史下的
前复权行情一致，目前只能获取全部日线后在调用方过滤。

期望：
1. 请确认这是接口设计还是缺陷；
2. 如果是设计行为，希望文档明确说明复权基准与查询范围的关系；
3. 希望增加固定复权锚点或“始终按最新交易日复权”的参数，使调用方可以
   查询短区间，同时获得稳定一致的历史前复权价格。

最小复现代码：
附上本文“最小复现代码”全文。

实际输出：
附上两段比较结果及 summary。
```
