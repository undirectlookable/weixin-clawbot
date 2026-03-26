#!/usr/bin/env node

import {
  DEFAULT_BASE_URL,
  MAX_QR_REFRESH_COUNT,
  QR_LOGIN_TIMEOUT_MS,
  QR_POLL_INTERVAL_MS,
} from "./core/constants.js";
import { createDebugLogger } from "./core/debug.js";
import { loadBotEnvConfig } from "./core/env.js";
import { fetchQrCode, fetchQrStatus } from "./transport/api/qr-api.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printUsage(): void {
  process.stdout.write("Usage:\n");
  process.stdout.write("  npx weixin-clawbot -- --auth\n");
  process.stdout.write("  npx weixin-clawbot -- --auth --debug\n");
}

async function runInit(params: {
  baseUrl: string;
  debug: boolean;
}): Promise<void> {
  const logger = createDebugLogger({
    enabled: params.debug,
  }).child("cli");
  const qrDebug = logger.child("qr");
  const baseUrl = params.baseUrl;

  logger.log("init.start", {
    baseUrl,
  });

  const qr = await fetchQrCode({
    baseUrl,
    botType: "3",
    debug: qrDebug,
  });
  let qrcode = qr.qrcode;
  let qrRefreshCount = 1;
  let scannedPrinted = false;

  logger.log("qr.created", {
    qrRefreshCount,
    hasQrCodeImage: Boolean(qr.qrcode_img_content),
  });

  process.stdout.write("请使用微信扫描以下二维码链接：\n");
  process.stdout.write(`${qr.qrcode_img_content}\n\n`);

  const deadline = Date.now() + QR_LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await fetchQrStatus({
      baseUrl,
      qrcode,
      debug: qrDebug,
    });
    logger.log("qr.status", {
      status: status.status,
      qrRefreshCount,
    });

    if (status.status === "wait") {
      await sleep(QR_POLL_INTERVAL_MS);
      continue;
    }

    if (status.status === "scaned") {
      if (!scannedPrinted) {
        process.stdout.write("已扫码，请在微信中确认登录。\n");
        scannedPrinted = true;
      }
      await sleep(QR_POLL_INTERVAL_MS);
      continue;
    }

    if (status.status === "expired") {
      qrRefreshCount += 1;
      if (qrRefreshCount > MAX_QR_REFRESH_COUNT) {
        throw new Error("二维码多次过期，请重新执行 --auth");
      }
      const refreshed = await fetchQrCode({
        baseUrl,
        botType: "3",
        debug: qrDebug,
      });
      qrcode = refreshed.qrcode;
      scannedPrinted = false;
      logger.log("qr.refreshed", {
        qrRefreshCount,
      });
      process.stdout.write(
        `二维码已过期，已刷新 (${qrRefreshCount}/${MAX_QR_REFRESH_COUNT})：\n`,
      );
      process.stdout.write(`${refreshed.qrcode_img_content}\n\n`);
      await sleep(QR_POLL_INTERVAL_MS);
      continue;
    }

    if (status.status === "confirmed") {
      const token = status.bot_token ?? "";
      const userId = status.ilink_user_id ?? "";
      const finalBaseUrl = status.baseurl?.trim() || baseUrl;

      logger.log("init.success", {
        hasToken: Boolean(token),
        hasUserId: Boolean(userId),
        baseUrl: finalBaseUrl,
      });

      process.stdout.write("登录成功，凭据如下：\n");
      process.stdout.write(
        `${JSON.stringify(
          {
            token,
            userId,
            baseUrl: finalBaseUrl,
          },
          null,
          2,
        )}\n\n`,
      );

      process.stdout.write("环境变量示例：\n");
      process.stdout.write(`WEIXIN_CLAWBOT_TOKEN="${token}"\n`);
      process.stdout.write(`WEIXIN_CLAWBOT_USER_ID="${userId}"\n`);
      process.stdout.write(`WEIXIN_CLAWBOT_BASE_URL="${finalBaseUrl}"\n`);
      return;
    }

    await sleep(QR_POLL_INTERVAL_MS);
  }

  throw new Error("登录超时，请重新执行 --auth");
}

function parseCliOptions(argv: string[]): {
  init: boolean;
  debug: boolean;
} {
  return {
    init: argv.includes("--auth"),
    debug: argv.includes("--debug"),
  };
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  if (!options.init) {
    printUsage();
    return;
  }

  const env = loadBotEnvConfig();
  await runInit({
    baseUrl: env.baseUrl ?? DEFAULT_BASE_URL,
    debug: options.debug || env.debug,
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`weixin-clawbot init failed: ${message}\n`);
  process.exitCode = 1;
});
