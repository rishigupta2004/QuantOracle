import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { universe, customSymbols, factors, weights, params } = body

    if (!universe || !factors || factors.length === 0) {
      return NextResponse.json(
        { message: "Invalid input: universe and at least one factor required" },
        { status: 400 }
      )
    }

    const config = {
      universe,
      customSymbols: customSymbols || [],
      factors,
      weights,
      params,
    }

    const configPath = join("/tmp", `backtest-${Date.now()}.json`)
    await writeFile(configPath, JSON.stringify(config))

    const pythonProcess = spawn(
      process.env.PYTHON_PATH || "python",
      ["-m", "quant.lab.backtest", "--config", configPath],
      {
        cwd: process.cwd(),
        env: { ...process.env },
      }
    )

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        pythonProcess.stdout.on("data", (data: Buffer) => {
          const lines = data.toString().split("\n").filter(Boolean)
          for (const line of lines) {
            try {
              const event = JSON.parse(line)
              if (event.type === "progress" || event.type === "result" || event.type === "error") {
                controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
              }
            } catch {
              // Skip malformed JSON
            }
          }
        })

        pythonProcess.stderr.on("data", (data: Buffer) => {
          console.error("Python stderr:", data.toString())
        })

        pythonProcess.on("close", async (code) => {
          try {
            await unlink(configPath)
          } catch {
            // Ignore cleanup errors
          }
          if (code !== 0) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "error", message: `Process exited with code ${code}` }) + "\n"
              )
            )
          }
          controller.close()
        })
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (err) {
    console.error("Backtest error:", err)
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
