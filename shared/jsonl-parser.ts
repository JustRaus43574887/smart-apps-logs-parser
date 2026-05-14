import {
  LogEntry,
  LOG_TYPE,
  JsonParserEntry,
  COLORS,
  LOG_STATUS,
} from "./types";

export class JSONLinesParser {
  public static parse(content: string): JsonParserEntry[] {
    const entries: JsonParserEntry[] = [];
    const lines = content.trim().split("\n");

    lines.forEach((line, index) => {
      if (!line.trim()) {
        return; // Пропускаем пустые строки
      }

      try {
        const obj = JSON.parse(line);
        const entry = this.validateAndNormalize(obj);
        entries.push(entry);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        throw new Error(
          `Ошибка парсинга на строке ${index + 1}: ${errorMessage}`,
        );
      }
    });

    return entries;
  }

  private static getTextColor(data: LogEntry): COLORS {

    if ([LOG_TYPE.DEVICE_INFO, LOG_TYPE.CLIENT_STATE].includes(data.type)) {
      return COLORS.LIGHT_GRAY;
    }

    switch (data.status as LOG_STATUS) {
      case LOG_STATUS.SUCCESS:
        return COLORS.GREEN;
      case LOG_STATUS.ERROR:
        return COLORS.RED;
      case LOG_STATUS.INFO:
      default:
        return COLORS.BLUE;
    }
  }

  private static validateAndNormalize(obj: unknown): JsonParserEntry {
    if (typeof obj !== "object" || obj === null) {
      throw new Error("Ожидается объект");
    }

    const data = obj as LogEntry;

    // Проверяем обязательные поля
    if (typeof data.timestamp !== "string") {
      throw new Error("Поле timestamp должно быть строкой");
    }

    if (typeof data.type !== "string") {
      throw new Error("Поле type должно быть строкой");
    }

    if (typeof data.message !== "string") {
      throw new Error("Поле message должно быть строкой");
    }

    // Проверяем, что type является допустимым значением
    if (!Object.values(LOG_TYPE).includes(data.type as LOG_TYPE)) {
      throw new Error(
        `Неизвестный тип логов: ${data.type}. Допустимые значения: ${Object.values(LOG_TYPE).join(", ")}`,
      );
    }

    // Проверяем payload, если присутствует
    if (
      data.payload !== undefined &&
      (typeof data.payload !== "object" || data.payload === null)
    ) {
      throw new Error("Поле payload должно быть объектом");
    }

    return {
      id:  `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(parseInt(data.timestamp, 10)).toISOString(),
      type: data.type as LOG_TYPE,
      message: data.message,
      payload: data.payload as Record<string, unknown>,
      status: data.status as LOG_STATUS,
      textColor: this.getTextColor(data),
    };
  }
}
