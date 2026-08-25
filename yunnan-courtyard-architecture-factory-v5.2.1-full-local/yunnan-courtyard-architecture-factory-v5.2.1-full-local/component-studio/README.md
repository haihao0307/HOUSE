# 云南建筑组件工作台 V1

该页面把云南历史建筑生产线拆成八个独立工作室，并通过统一组件注册表和总装清单连接。

## 在线入口

```text
component-studio/index.html
```

独立工作室使用查询参数打开，例如：

```text
component-studio/?module=tilework
component-studio/?module=walls
component-studio/?module=openings
component-studio/?module=timber-surface
```

## 八个工作室

1. 建筑知识与空间蓝图
2. 台基、地基与场地
3. 木结构几何
4. 屋顶形制与屋面基层
5. 瓦作生产线
6. 墙体与墙面生产线
7. 门窗与木隔扇
8. 木纹与木材表面

## 本机数据

文字、任务、状态和总装候选保存在浏览器 localStorage。图片、PDF、JSON 和其他资料保存在 IndexedDB。不同标签页通过 BroadcastChannel 同步状态。

页面可导出单模块 JSON 或完整工作区 JSON。附件文件本体继续保存在浏览器，导出包记录附件文件名、类型、大小和 SHA256。

## 后续接入

每个工作室将逐步连接独立组件生成器、独立视觉页面、独立 QA 合同和独立版本清单。组件达到 `production_locked` 后才进入总装器。
