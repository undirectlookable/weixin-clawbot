import { defineConfig } from "vitepress";

export default defineConfig({
  title: "weixin-clawbot",
  description: "weixin-clawbot documentation",
  base: "/weixin-clawbot/",
  locales: {
    root: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
    },
    // en: {
    //   label: "English",
    //   lang: "en-US",
    //   link: "/en/",
    // },
  },
  themeConfig: {
    nav: [
      {
        text: "首页",
        link: "/zh/",
        activeMatch: "^/zh/$",
      },
      {
        text: "指南",
        link: "/zh/guide/quick-start",
        activeMatch: "^/zh/guide/",
      },
      {
        text: "参考",
        link: "/zh/reference/api",
        activeMatch: "^/zh/reference/",
      },
    ],
    sidebar: {
      "/zh/guide/": [
        {
          text: "介绍",
          items: [
            {
              text: "什么是 weixin-clawbot",
              link: "/zh/guide/what-is-weixin-clawbot",
            },
            { text: "快速开始", link: "/zh/guide/quick-start" },
            { text: "示例程序", link: "/zh/guide/run-example" },
          ],
        },
        {
          text: "消息",
          items: [
            { text: "接收消息", link: "/zh/guide/receiving-messages" },
            { text: "发送消息", link: "/zh/guide/sending-messages" },
          ],
        },
      ],
      "/zh/reference/": [
        {
          text: "API 定义",
          items: [
            { text: "运行时 API", link: "/zh/reference/api" },
            { text: "类型定义", link: "/zh/reference/types" },
          ],
        },
        {
          text: "概念",
          items: [{ text: "状态存储", link: "/zh/reference/state" }],
        },
      ],
    },
  },
});
