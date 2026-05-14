export enum COLORS {
  RED = "red",
  YELLOW = "yellow",
  BLUE = "#1890ff",
  DARK = "#1f1f1f",
  LIGHT = '#f5f5f5'
}

export enum LOG_TYPE {
  DEVICE_INFO = "device_info",
  REST_EVENT = "rest_event",
  WEBSOCKET_EVENT = "websocket_event",
  BROWSER_LOG = "browser_log",
  SMARTAPP_EVENT = "smartapp_event",
  CLIENT_LOG = "client_log",
  CLIENT_STATE = "client_state",
}

export enum LOG_STATUS {
  SUCCESS = "success",
  ERROR = "error",
  INFO = "info",
}

export interface LogEntry<T = unknown> {
  timestamp: string;
  type: LOG_TYPE;
  message: string;
  status: LOG_STATUS;
  payload: Record<string, T>;
}

export interface JsonParserEntry extends LogEntry {
  id: string;
  textColor: COLORS;
}
