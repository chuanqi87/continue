import iconv from "iconv-lite";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ToolImpl } from ".";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import {
  markProcessAsRunning,
  removeRunningProcess,
} from "../../util/processTerminalStates";
import { getStringArg } from "../parseArgs";

// 自动根据平台解码缓冲区以避免中文乱码
function getDecodedOutput(data: Buffer): string {
  if (process.platform === "win32") {
    try {
      let out = iconv.decode(data, "utf-8");
      if (/�/.test(out)) {
        out = iconv.decode(data, "gbk");
      }
      return out;
    } catch {
      return iconv.decode(data, "gbk");
    }
  } else {
    return data.toString();
  }
}

// 获取 shell 命令（与 runTerminalCommand 一致）
function getShellCommand(command: string): { shell: string; args: string[] } {
  if (process.platform === "win32") {
    // Windows: Use PowerShell
    return {
      shell: "powershell.exe",
      args: ["-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", command],
    };
  } else {
    // Unix/macOS: Use login shell to source .bashrc/.zshrc etc.
    const userShell = process.env.SHELL || "/bin/bash";
    return { shell: userShell, args: ["-l", "-c", command] };
  }
}

// 添加颜色支持的环境变量（与 runTerminalCommand 一致）
const getColorEnv = () => ({
  ...process.env,
  FORCE_COLOR: "1",
  COLORTERM: "truecolor",
  TERM: "xterm-256color",
  CLICOLOR: "1",
  CLICOLOR_FORCE: "1",
});

/**
 * 根据当前平台和插件目录获取 HBuilderX CLI 路径
 * 插件路径结构:
 * - macOS: /Applications/HBuilderX.app/Contents/HBuilderX/plugins/continue-hbuilderx/
 * - Windows: C:\Program Files\HBuilderX\plugins\continue-hbuilderx\
 */
function getHBuilderXCliPath(): string {
  const platform = process.platform;

  try {
    // 尝试从插件目录相对路径查找
    // __dirname 在编译后的代码中指向插件的 out 目录
    // 需要根据实际部署结构调整
    let extensionDir = __dirname;

    // 如果是在 core/tools/implementations 目录中，需要向上导航到插件根目录
    // 通常编译后的结构是: plugins/continue-hbuilderx/out/...
    const candidates: string[] = [];

    if (platform === "darwin") {
      // macOS 路径结构:
      // 插件 __dirname: /Applications/HBuilderX.app/Contents/HBuilderX/plugins/continue-hbuilderx/out/
      // CLI 目标: /Applications/HBuilderX.app/Contents/MacOS/cli
      // 相对路径: ../../../../MacOS/cli (向上4级)
      candidates.push(
        path.resolve(extensionDir, "..", "..", "..", "..", "MacOS", "cli"),
      );

      // 兜底：使用绝对路径
      candidates.push(
        "/Applications/HBuilderX.app/Contents/MacOS/cli",
        "/Applications/HBuilderX-Alpha.app/Contents/MacOS/cli",
        "/Applications/HBuilderX-Dev.app/Contents/MacOS/cli",
      );
    } else if (platform === "win32") {
      // Windows 路径结构:
      // 插件 __dirname: C:\Program Files\HBuilderX\plugins\continue-hbuilderx\out\
      // CLI 目标: C:\Program Files\HBuilderX\cli.exe
      // 相对路径: ..\..\..\cli.exe (向上3级)
      candidates.push(path.resolve(extensionDir, "..", "..", "..", "cli.exe"));

      // 兜底：尝试从常见安装位置查找
      const programFiles = [
        process.env["ProgramFiles"],
        process.env["ProgramFiles(x86)"],
        "C:\\Program Files",
        "D:\\Program Files",
      ];

      for (const pf of programFiles) {
        if (!pf) continue;
        candidates.push(
          path.join(pf, "HBuilderX", "cli.exe"),
          path.join(pf, "HBuilderX-Alpha", "cli.exe"),
          path.join(pf, "HBuilderX-Dev", "cli.exe"),
        );
      }
    } else {
      throw new Error(
        `[hbuilderx] 不支持的平台: ${platform}。打包构建工具仅支持 Windows 和 macOS。`,
      );
    }

    // 查找第一个存在的 CLI 路径
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        console.log("[hbuilderx] 解析到 CLI 路径:", candidate);
        return candidate;
      }
    }

    // 所有候选路径都不存在
    throw new Error(
      `[hbuilderx] 未找到 HBuilderX CLI 工具。已尝试的路径: ${candidates.join(", ")}`,
    );
  } catch (error: any) {
    console.error("[hbuilderx] 解析 CLI 路径失败:", error?.message || error);
    throw error;
  }
}

export const buildPackageImpl: ToolImpl = async (args, extras) => {
  const type = getStringArg(args, "type");
  const projectRoot = getStringArg(args, "projectRoot");
  const toolCallId = extras.toolCallId || "";

  // 验证参数
  if (!type || !projectRoot) {
    throw new ContinueError(
      ContinueErrorReason.Unspecified,
      "必须提供 type 和 projectRoot 参数",
    );
  }

  if (type !== "mp-harmony" && type !== "app-harmony") {
    throw new ContinueError(
      ContinueErrorReason.Unspecified,
      `无效的打包类型: ${type}。支持的类型: mp-harmony（元服务）, app-harmony（应用）`,
    );
  }

  try {
    // 获取 CLI 路径
    const cliPath = getHBuilderXCliPath();

    // 使用提供的项目根目录
    const cwd = projectRoot;

    // 验证项目根目录是否存在
    if (!fs.existsSync(cwd)) {
      throw new ContinueError(
        ContinueErrorReason.Unspecified,
        `项目根目录不存在: ${cwd}`,
      );
    }

    // 构建命令
    const command = `"${cliPath}" pack ${type} --project "${cwd}"`;
    console.log("[hbuilderx] 执行打包命令:", command);
    console.log("[hbuilderx] 工作目录:", cwd);

    return new Promise((resolve, reject) => {
      let output = "";

      // 初始状态输出
      if (extras.onPartialOutput) {
        extras.onPartialOutput({
          toolCallId,
          contextItems: [
            {
              name: "打包构建",
              description: "HBuilderX 打包构建输出",
              content: `正在打包 ${type === "mp-harmony" ? "元服务" : "应用"} 项目: ${cwd}\n`,
              status: "正在执行打包命令...",
            },
          ],
        });
      }

      // 使用 spawn 执行命令（与 runTerminalCommand 一致）
      const { shell, args } = getShellCommand(command);
      const childProc = childProcess.spawn(shell, args, {
        cwd,
        env: getColorEnv(), // 添加颜色支持
      });

      // 跟踪进程以支持取消操作（与 runTerminalCommand 一致）
      if (toolCallId) {
        markProcessAsRunning(toolCallId, childProc, extras.onPartialOutput, "");
      }

      childProc.stdout?.on("data", (data) => {
        const newOutput = getDecodedOutput(data);
        output += newOutput;

        if (extras.onPartialOutput) {
          extras.onPartialOutput({
            toolCallId,
            contextItems: [
              {
                name: "打包构建",
                description: "HBuilderX 打包构建输出",
                content: output,
                status: "正在打包...",
              },
            ],
          });
        }
      });

      childProc.stderr?.on("data", (data) => {
        const newOutput = getDecodedOutput(data);
        output += newOutput;

        if (extras.onPartialOutput) {
          extras.onPartialOutput({
            toolCallId,
            contextItems: [
              {
                name: "打包构建",
                description: "HBuilderX 打包构建输出",
                content: output,
              },
            ],
          });
        }
      });

      childProc.on("close", (code) => {
        // 清理进程跟踪
        if (toolCallId) {
          removeRunningProcess(toolCallId);
        }

        if (code === 0) {
          const status = `打包完成 - 项目: ${cwd}`;
          resolve([
            {
              name: "打包构建",
              description: "HBuilderX 打包构建输出",
              content: output || "打包成功完成",
              status: status,
            },
          ]);
        } else {
          const status = `打包失败 - 退出码: ${code}`;
          resolve([
            {
              name: "打包构建",
              description: "HBuilderX 打包构建输出",
              content: output || "打包失败",
              status: status,
            },
          ]);
        }
      });

      childProc.on("error", (error) => {
        // 清理进程跟踪
        if (toolCallId) {
          removeRunningProcess(toolCallId);
        }

        reject(
          new ContinueError(
            ContinueErrorReason.CommandExecutionFailed,
            `打包命令执行失败: ${error.message}`,
          ),
        );
      });
    });
  } catch (error: any) {
    console.error("[hbuilderx] 打包构建失败:", error);
    throw new ContinueError(
      ContinueErrorReason.CommandExecutionFailed,
      `打包构建失败: ${error.message || error.toString()}`,
    );
  }
};
