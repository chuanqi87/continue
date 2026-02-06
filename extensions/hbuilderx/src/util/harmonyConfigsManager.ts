import { HbuilderXIde } from "../HBuilderXIde";

/**
 * Harmony配置管理器
 * 负责检测和管理harmony-configs和harmony-mp-configs目录下的配置文件
 */
export class HarmonyConfigsManager {
  // 需要检测的目录列表
  private static readonly HARMONY_DIRS = [
    "harmony-configs",
    "harmony-mp-configs",
  ];

  // string.json相对路径
  private static readonly STRING_JSON_PATH =
    "AppScopes/resources/base/element/string.json";

  // 必需的字段配置
  private static readonly REQUIRED_FIELDS = [
    {
      name: "agcit_agc_common_uniapp",
      value: "1.0.0",
    },
    {
      name: "agcittype_agc_common_uniapp",
      value: "industryTemplate",
    },
    {
      name: "agcittype_agc_common_uniapp_plugin",
      value: "AI Plugin",
    },
  ];

  constructor(private readonly ide: HbuilderXIde) {}

  /**
   * 检测并创建/更新所有harmony配置目录
   */
  async checkAndUpdateAll(): Promise<void> {
    try {
      console.log("[hbuilderx] 开始检测Harmony配置目录");

      // 获取工作区目录
      const workspaceDirs = await this.ide.getWorkspaceDirs();
      if (workspaceDirs.length === 0) {
        console.log("[hbuilderx] 未找到工作区目录，跳过Harmony配置检测");
        return;
      }

      // 遍历所有工作区目录
      for (const workspaceDir of workspaceDirs) {
        console.log("[hbuilderx] 检测工作区:", workspaceDir);
        await this.checkWorkspace(workspaceDir);
      }

      console.log("[hbuilderx] Harmony配置检测完成");
    } catch (error) {
      console.error("[hbuilderx] checkAndUpdateAll执行失败:", error);
      throw error;
    }
  }

  /**
   * 检测单个工作区
   */
  private async checkWorkspace(workspaceDir: string): Promise<void> {
    // 遍历所有需要检测的目录
    for (const harmonyDir of HarmonyConfigsManager.HARMONY_DIRS) {
      await this.checkHarmonyDir(workspaceDir, harmonyDir);
    }
  }

  /**
   * 检测单个harmony目录
   */
  private async checkHarmonyDir(
    workspaceDir: string,
    harmonyDirName: string,
  ): Promise<void> {
    try {
      // 构建harmony目录路径
      const harmonyDirUri = `${workspaceDir}/${harmonyDirName}`;

      // 检查harmony目录是否存在
      const harmonyDirExists = await this.ide.fileExists(harmonyDirUri);
      if (!harmonyDirExists) {
        console.log(
          `[hbuilderx] 工作区下不存在${harmonyDirName}目录，跳过:`,
          workspaceDir,
        );
        return;
      }

      console.log(`[hbuilderx] 找到${harmonyDirName}目录，检测string.json文件`);

      // 构建string.json文件路径
      const stringJsonUri = `${harmonyDirUri}/${HarmonyConfigsManager.STRING_JSON_PATH}`;

      // 检查string.json文件是否存在
      const stringJsonExists = await this.ide.fileExists(stringJsonUri);

      if (stringJsonExists) {
        console.log(
          `[hbuilderx] ${harmonyDirName}/string.json已存在，检查并补充必要字段`,
        );
        await this.updateStringJsonIfNeeded(stringJsonUri);
      } else {
        console.log(
          `[hbuilderx] ${harmonyDirName}/string.json不存在，开始创建`,
        );
        await this.createStringJson(workspaceDir, stringJsonUri);
      }
    } catch (error) {
      console.error(`[hbuilderx] 检测${harmonyDirName}目录失败:`, error);
      // 单个目录失败不影响其他目录的检测
    }
  }

  /**
   * 从manifest.json读取app_name
   */
  private async getAppNameFromManifest(workspaceDir: string): Promise<string> {
    try {
      const manifestUri = `${workspaceDir}/manifest.json`;
      const manifestExists = await this.ide.fileExists(manifestUri);

      if (!manifestExists) {
        console.log("[hbuilderx] manifest.json不存在，使用默认app_name");
        return "应用名称";
      }

      const manifestContent = await this.ide.readFile(manifestUri);
      const manifest = JSON.parse(manifestContent);

      if (manifest.name) {
        console.log(
          "[hbuilderx] 从manifest.json读取到app_name:",
          manifest.name,
        );
        return manifest.name;
      } else {
        console.log(
          "[hbuilderx] manifest.json中没有name字段，使用默认app_name",
        );
        return "应用名称";
      }
    } catch (error) {
      console.error("[hbuilderx] 读取manifest.json失败:", error);
      return "应用名称";
    }
  }

  /**
   * 创建新的string.json文件
   */
  private async createStringJson(
    workspaceDir: string,
    stringJsonUri: string,
  ): Promise<void> {
    try {
      // 从manifest.json读取app_name
      const appName = await this.getAppNameFromManifest(workspaceDir);

      // 创建默认的string.json内容
      const stringJsonContent = {
        string: [
          {
            name: "app_name",
            value: appName,
          },
          ...HarmonyConfigsManager.REQUIRED_FIELDS,
        ],
      };

      const jsonString = JSON.stringify(stringJsonContent, null, 2);

      // 写入文件（writeFile会自动创建不存在的目录）
      await this.ide.writeFile(stringJsonUri, jsonString);

      console.log("[hbuilderx] 成功创建string.json文件:", stringJsonUri);
    } catch (error) {
      console.error("[hbuilderx] 创建string.json失败:", error);
      throw error;
    }
  }

  /**
   * 更新已存在的string.json文件，补充缺失的字段
   */
  private async updateStringJsonIfNeeded(stringJsonUri: string): Promise<void> {
    try {
      // 读取现有文件
      const content = await this.ide.readFile(stringJsonUri);
      const stringJson = JSON.parse(content);

      if (!stringJson.string || !Array.isArray(stringJson.string)) {
        console.log("[hbuilderx] string.json格式不正确，跳过更新");
        return;
      }

      // 检查是否已存在必需字段
      const existingNames = stringJson.string.map((item: any) => item.name);
      const missingFields = HarmonyConfigsManager.REQUIRED_FIELDS.filter(
        (field) => !existingNames.includes(field.name),
      );

      if (missingFields.length === 0) {
        console.log("[hbuilderx] string.json已包含所有必需字段，无需更新");
        return;
      }

      // 添加缺失的字段
      console.log(
        `[hbuilderx] 添加${missingFields.length}个缺失字段:`,
        missingFields.map((f) => f.name).join(", "),
      );

      for (const field of missingFields) {
        stringJson.string.push(field);
      }

      // 写回文件
      const jsonString = JSON.stringify(stringJson, null, 2);
      await this.ide.writeFile(stringJsonUri, jsonString);
      console.log("[hbuilderx] 成功更新string.json文件");
    } catch (error) {
      console.error("[hbuilderx] 更新string.json失败:", error);
      throw error;
    }
  }
}
