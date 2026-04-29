# Function Calling

Function Calling 让模型可以发现并调用服务端注册的工具。适合查询业务系统、触发轻量动作或访问受控数据源。

## 注册工具

实现 `ToolDefinition` 并注册为 Spring Bean：

```java
@Component
public class WeatherTool implements ToolDefinition {
    @Override
    public String name() {
        return "get_weather";
    }

    @Override
    public String description() {
        return "查询指定城市的天气";
    }

    @Override
    public Object call(Map<String, Object> arguments) {
        return Map.of("city", arguments.get("city"), "weather", "sunny");
    }
}
```

启动后，工具会进入工具注册表，模型在需要时可以触发调用。

## 使用建议

- 工具名称保持稳定，避免频繁改名。
- 参数 schema 要尽量明确，减少模型误调用。
- 工具内部必须做权限和参数校验，不要只依赖模型输入。
- 对外部系统调用设置超时、重试和熔断。
- 对有副作用的工具增加审计日志。

## 与 Data Connector 的关系

Data Connector 会自动注册 `list_modules`、`get_schema`、`query_data` 等工具。自定义 Function Calling 更适合业务特定动作，例如审批、通知、查询订单详情等。

