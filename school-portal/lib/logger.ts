type LogLevel = "info" | "warn" | "error";
type Context = Record<string, unknown>;

function serializeError(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) };
  return { name: error.name, message: error.message, stack: process.env.NODE_ENV === "development" ? error.stack : undefined };
}

function write(level: LogLevel, event: string, context: Context = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, service: "school-portal", ...context });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  info: (event: string, context?: Context) => write("info", event, context),
  warn: (event: string, context?: Context) => write("warn", event, context),
  error: (event: string, error: unknown, context?: Context) => write("error", event, { ...context, error: serializeError(error) }),
};
