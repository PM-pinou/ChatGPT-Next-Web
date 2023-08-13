import { NextRequest, NextResponse } from "next/server";

export const OPENAI_URL = "api.openai.com";
const DEFAULT_PROTOCOL = "https";
const PROTOCOL = process.env.PROTOCOL || DEFAULT_PROTOCOL;
const BASE_URL = "https://gptgod.online/api" || OPENAI_URL;
const DISABLE_GPT4 = !!process.env.DISABLE_GPT4;

export async function requestOpenai(req: NextRequest) {
  const controller = new AbortController();
  const authValue = req.headers.get("Authorization") ?? "";
  const openaiPath = `${req.nextUrl.pathname}${req.nextUrl.search}`.replaceAll(
    "/api/openai/",
    "",
  );

  let baseUrl = BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `${PROTOCOL}://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[Proxy] ", openaiPath);
  console.log("[Base Url]", baseUrl);

  if (process.env.OPENAI_ORG_ID) {
    console.log("[Org ID]", process.env.OPENAI_ORG_ID);
  }

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10 * 60 * 1000);

  const fetchUrl = `${baseUrl}/${openaiPath}`;
  const fetchOptions: RequestInit = {
    // headers: {
    //   "Content-Type": "application/json",
    //   "Cache-Control": "no-store",
    //   Authorization: authValue,
    //   ...(process.env.OPENAI_ORG_ID && {
    //     "OpenAI-Organization": process.env.OPENAI_ORG_ID,
    //   }),
    //
    // },
    headers: {
      authorization:
        "Bearer sk-VuUM6Qsq5VvsF9YRWajxgt6WbV5FuAp2cfPkHpJKwSII1jK8",
      "x-requested-with": "XMLHttpRequest",
      "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
      "content-type": "application/json",
      Accept: "*/*",
      Host: "gptgod.online",
      Connection: "keep-alive",
    },
    method: req.method,
    body: req.body,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "follow",
    // @ts-ignore
    duplex: "half",
    // signal: controller.signal,
  };

  var myHeaders = new Headers();
  myHeaders.append(
    "authorization",
    "Bearer sk-VuUM6Qsq5VvsF9YRWajxgt6WbV5FuAp2cfPkHpJKwSII1jK8",
  );
  myHeaders.append("x-requested-with", "XMLHttpRequest");
  myHeaders.append("User-Agent", "Apifox/1.0.0 (https://apifox.com)");
  myHeaders.append("content-type", "application/json");
  myHeaders.append("Accept", "*/*");
  myHeaders.append("Host", "gptgod.online");
  myHeaders.append("Connection", "keep-alive");

  var raw = JSON.stringify({
    messages: [
      {
        role: "system",
        content:
          "\nYou are ChatGPT, a large language model trained by OpenAI.\nKnowledge cutoff: 2021-09\nCurrent model: gpt-3.5-turbo-16k\nCurrent time: 2023/8/10 13:42:51\n",
      },
      {
        role: "user",
        content: "你好",
      },
      {
        role: "assistant",
        content: "你好，有什么可以帮助你的吗？",
      },
      {
        role: "user",
        content: "你好",
      },
    ],
    stream: true,
    model: "gpt-3.5-turbo-16k",
    temperature: 0.5,
    presence_penalty: 0,
    frequency_penalty: 0,
    top_p: 1,
  });

  var requestOptions: RequestInit = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };

  // #1815 try to refuse gpt4 request
  if (DISABLE_GPT4 && req.body) {
    try {
      const clonedBody = await req.text();
      fetchOptions.body = clonedBody;

      const jsonBody = JSON.parse(clonedBody);

      if ((jsonBody?.model ?? "").includes("gpt-4")) {
        return NextResponse.json(
          {
            error: true,
            message: "you are not allowed to use gpt-4 model",
          },
          {
            status: 403,
          },
        );
      }
    } catch (e) {
      console.error("[OpenAI] gpt4 filter", e);
    }
  }

  try {
    console.log(fetchOptions.headers);
    const res = await fetch(
      "https://gptgod.online/api/v1/chat/completions",
      fetchOptions,
    );
    console.log(res.headers);
    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    newHeaders.delete("Authorization");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
