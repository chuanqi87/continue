- # HBuilderX Continue AI编程助手 - 使用指南

本插件是AI辅助插件Continue在HBuilderX上的适配版本，并对转换鸿蒙元服务进行深度优化，为开发者提供智能的聊天对话、代码编辑等AI辅助能力。

可以对uni-app工程进行转鸿蒙应用、鸿蒙元服务进行分析，对manifest文件进行配置、对代码进行分析，并给出修改建议。

## 安装指导

### 插件市场安装

插件市场搜索`AI编程助手`进行下载安装， MAC版使用`AI编程助手-MAC`版本。

## 配置指南

1. 重启HBuilderX，在`视图-->扩展插件视图-->Harmony Bot`可进入插件。
   ![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-1.png?token=3ddf2aed-da6c-443e-9d79-311e80d49325)
   ![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-2.png?token=61f5d58f-a04b-4dba-a10d-630b46f26f9d)
2. 首次进入插件需要配置对接的模型，需要到`C:\Users\XXX\.continue\config.yaml`配置模型，当前需要开发者自行配置对接模型的API KEY,开发者可自行选择模型。
   ![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-3.png?token=993fb98a-281e-49a9-bc6e-e75c3b6961a6)

   DeepSeek模型配置如下

   ```yaml
   - name: DeepSeek
   provider: openai
   model: deepseek-chat
   apiKey: YOUR_API_KEY
   apiBase: https://api.deepseek.com/
   defaultCompletionOptions:
     contextLength: 1048576
     maxTokens: 8192
   roles:
     - chat
     - apply
   capabilities:
     - tool_use
   ```

   千问模型配置如下

   ```yaml
    - name: QWen3-Coder
    provider: openai
    model: qwen3-coder-plus
    apiKey: YOUR_API_KEY
    apiBase: https://dashscope.aliyuncs.com/compatible-mode/v1
    defaultCompletionOptions:
      contextLength: 1048576
      maxTokens: 8192
    roles:
      - chat
      - apply
    capabilities:
      - tool_use
   ```

3. **关键一步，切换当前要适配的类型**，当前支持鸿蒙应用和鸿蒙元服务，对此场景进行增强适配，默认模式为常规辅助编码能力。
   ![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage15.png?token=c1bd0044-e0fc-4a42-9193-e362b40b2ccc)

4. 在插件中切换到对应模型即可进行对话。
   ![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-5.png?token=f3621469-aa38-445c-b00d-ca45cc851255)

5. 在`工具-->HarmonyBot`下有新建聊天、查看历史记录、打开设置功能。
   ![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-9.png?token=5b994b40-64f9-49ae-8e2a-a7af1d031218)

## 使用指南

### Plan模式

此模式下可以对当前工程进行理解感知，可以先通过此模式让模型分析并制定出适配计划。
![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-6.png?token=cb2e6e7c-bdad-4e11-b214-0f34ac833430)

模型会调用工具分析当前工程
![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-7.png?token=cb614d7c-b94a-4188-b51d-c22de6374611)

分析结束后会生成一份`Planning.md`文件记录
![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-8.png?token=bbf931fe-1e23-4d7f-8329-dbb73e3a0d39)

### Agent模式

此模式下可以调用全部工具，可以对工程进行编辑，可以根据适配计划逐步修改对应文件进行修改。
可通过@命令调用出上下文，并把要修改的代码文件作为上下文传递到模型。
![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-10.png?token=71327e59-a14a-4874-9906-83fc07bb9988)
并给他指定任务，如适配元服务
![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-11.png?token=8cd9d690-9a20-4c5e-b355-3c1aa3918dc0)

返回的代码可暂时复制到原代码中进行对比合入（ps：后续会更新支持直接插入进行对比）。
![alt text](https://agc-storage-drcn.platform.dbankcloud.cn/v0/default-bucket-qxx9w/image%2Fimage-12.png?token=13e148f6-a735-4943-890b-29f46066b3a9)

之后根据前期分析出来是适配计划逐个文件修改，最终完成适配。

## 注意事项

1. 因AI需要对工程进行分析，如果整个工程代码量比较大，受模型上下文的限制，无法准备识别出全部修改点，建议对于大工程逐个子模块进行分析，可在prompt中增加相对路径，让模型只针对相对路径下代码进行分析。

## 后续功能

- [ ] 支持代码返回后直接编辑合入到现有工程。
- [x] 支持调用编译构建命令并根据错误信息分析针对性修改。
- [ ] 预置Prompt指令方便开发者快速使用。
