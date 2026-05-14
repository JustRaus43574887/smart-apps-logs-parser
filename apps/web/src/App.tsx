import { useMemo, useState, Fragment } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  Flex,
  Collapse,
  Badge,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  CloseOutlined,
  DownOutlined,
  UpOutlined,
  UploadOutlined,
  BugOutlined,
  BugFilled,
} from "@ant-design/icons";
import {
  COLORS,
  JsonParserEntry,
  LOG_TYPE,
  LOG_STATUS,
} from "../../../shared/types";
import { JSONLinesParser } from "../../../shared/jsonl-parser";
import { CollapseProps } from "antd/lib";

export const toTitleCase = (text: string) => {
  return text
    .split("_")
    .filter((x) => x.length > 0)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
};

// ==================== УТИЛИТЫ ДЛЯ ПЕРЕНОСОВ СТРОК И ПОДСВЕТКИ ====================

const nl2br = (text: string): React.ReactNode => {
  if (!text) return null;
  return text.split(/(\r\n|\r|\n)/g).map((part, index) => {
    if (/\r\n|\r|\n/.test(part)) {
      return <br key={index} />;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
};

const addKeyMarkers = (jsonString: string): string => {
  return jsonString.replace(/"([^"]+)":/g, '[KEY_START]"$1"[KEY_END]:');
};

const highlightSearchMarkers = (
  jsonString: string,
  searchText: string,
  isStrict: boolean,
): string => {
  if (!searchText.trim()) return jsonString;

  const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, isStrict ? "g" : "gi");
  return jsonString.replace(
    regex,
    (match) => `[HIGHLIGHT_START]${match}[HIGHLIGHT_END]`,
  );
};

const renderHighlightedJson = (
  jsonString: string,
  searchText: string = "",
  isStrict: boolean = false,
): React.ReactNode => {
  if (!jsonString) return null;

  let html = jsonString
    .replace(/\\r\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "<br>");

  html = addKeyMarkers(html);
  html = highlightSearchMarkers(html, searchText, isStrict);

  const parts = html.split(
    /(\[HIGHLIGHT_START\]|\[HIGHLIGHT_END\]|\[KEY_START\]|\[KEY_END\])/,
  );

  return (
    <div className="jsonViewer">
      {parts.map((part, index) => {
        if (!part) return null;

        if (
          [
            "[HIGHLIGHT_START]",
            "[HIGHLIGHT_END]",
            "[KEY_START]",
            "[KEY_END]",
          ].includes(part)
        ) {
          return null;
        }

        const prev = parts[index - 1];

        if (prev === "[HIGHLIGHT_START]") {
          return (
            <mark
              key={index}
              style={{
                backgroundColor: COLORS.YELLOW,
                padding: "0",
              }}
            >
              {part}
            </mark>
          );
        }

        if (prev === "[KEY_START]") {
          return (
            <span
              key={index}
              style={{ fontWeight: "bold", color: COLORS.DARK }}
            >
              {part}
            </span>
          );
        }

        return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
      })}
    </div>
  );
};

const highlightText = (
  text: string,
  searchText: string,
  isStrict: boolean,
  skipConvert: boolean = false,
) => {
  if (!text) return null;

  if (!searchText.trim()) {
    return skipConvert ? text : nl2br(text);
  }

  if (isStrict) {
    const highlighted =
      text === searchText ? (
        <mark style={{ padding: "0", backgroundColor: COLORS.YELLOW }}>
          {text}
        </mark>
      ) : (
        text
      );
    return <>{highlighted}</>;
  }

  const parts = text.split(
    new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
  );

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === searchText.toLowerCase() ? (
          <mark
            key={index}
            style={{ padding: "0", backgroundColor: COLORS.YELLOW }}
          >
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{nl2br(part)}</Fragment>
        ),
      )}
    </>
  );
};

const searchInValue = (
  value: unknown,
  searchText: string,
  isStrict: boolean,
): boolean => {
  if (typeof value === "string") {
    return isStrict
      ? value === searchText
      : value.toLowerCase().includes(searchText.toLowerCase());
  }
  if (typeof value === "number") {
    return isStrict
      ? String(value) === searchText
      : String(value).toLowerCase().includes(searchText.toLowerCase());
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(
      ([key, val]) =>
        searchInValue(key, searchText, isStrict) ||
        searchInValue(val, searchText, isStrict),
    );
  }
  if (Array.isArray(value)) {
    return value.some((val) => searchInValue(val, searchText, isStrict));
  }
  return false;
};

// ==================== КОМПОНЕНТЫ ====================

const allExpandedKeys = [
  "general",
  "headers",
  "request_headers",
  "response_headers",
  "request",
  "response",
];

const RestEventTabs = ({
  payload,
  searchText,
  isStrictSearch,
}: {
  payload: Record<string, any>;
  searchText: string;
  isStrictSearch: boolean;
}): React.ReactNode => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>(allExpandedKeys);

  const requestHeaders =
    payload.request &&
    typeof payload.request === "object" &&
    "headers" in payload.request
      ? (payload.request as Record<string, any>).headers
      : null;

  const responseHeaders =
    payload.response &&
    typeof payload.response === "object" &&
    "headers" in payload.response
      ? (payload.response as Record<string, any>).headers
      : null;

  const handleExpandAllCollapse = () => {
    if (expandedKeys.length > 0) {
      setExpandedKeys([]);
    } else {
      setExpandedKeys(allExpandedKeys);
    }
  };

  const restItems: CollapseProps["items"] = [
    {
      key: "general",
      label: "General",
      children: (
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: "url", label: "URL", children: payload.url || "-" },
            { key: "method", label: "Method", children: payload.method || "-" },
            {
              key: "status_code",
              label: "Status Code",
              children: payload.status_code || "0",
            },
            {
              key: "error_text",
              label: "Error Text",
              children: payload.error_text || "-",
            },
          ]}
        />
      ),
    },
    {
      key: "headers",
      label: "Headers",
      children: (
        <Flex vertical gap={12}>
          <Flex vertical gap={6}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Request Headers
            </Typography.Title>
            {Boolean(requestHeaders) ? (
              <Descriptions
                column={1}
                size="small"
                items={Object.entries(requestHeaders).map(([key, value]) => ({
                  key,
                  label: key,
                  children: String(value || "-"),
                }))}
              />
            ) : (
              <Typography.Text type="secondary">
                No request headers
              </Typography.Text>
            )}
          </Flex>
          <Flex vertical gap={6}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Response Headers
            </Typography.Title>
            {Boolean(responseHeaders) ? (
              <Descriptions
                column={1}
                size="small"
                items={Object.entries(responseHeaders).map(([key, value]) => ({
                  key,
                  label: key,
                  children: String(value || "-"),
                }))}
              />
            ) : (
              <Typography.Text type="secondary">
                No response headers
              </Typography.Text>
            )}
          </Flex>
        </Flex>
      ),
    },
    {
      key: "request",
      label: "Request",
      children: payload.request?.body ? (
        renderHighlightedJson(
          JSON.stringify(payload.request.body, null, 2),
          searchText,
          isStrictSearch,
        )
      ) : (
        <Typography.Text type="secondary">No request body</Typography.Text>
      ),
    },
    {
      key: "response",
      label: "Response",
      children: payload.response?.body ? (
        renderHighlightedJson(
          JSON.stringify(payload.response.body, null, 2),
          searchText,
          isStrictSearch,
        )
      ) : (
        <Typography.Text type="secondary">No response body</Typography.Text>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <Button
        onClick={handleExpandAllCollapse}
        icon={expandedKeys.length > 0 ? <UpOutlined /> : <DownOutlined />}
      >
        {expandedKeys.length > 0 ? "Свернуть все" : "Развернуть все"}
      </Button>
      <Collapse
        activeKey={expandedKeys}
        onChange={setExpandedKeys}
        items={restItems}
      />
    </Flex>
  );
};

const App = () => {
  const [allEntries, setAllEntries] = useState<JsonParserEntry[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<LOG_TYPE>>(new Set());
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStrictSearch, setIsStrictSearch] = useState(false);
  const [isAllRowsExpanded, setIsAllRowsExpanded] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const filteredEntries = useMemo(
    () =>
      allEntries.filter((entry) => {
        let matchesSearch = false;

        if (!searchText.trim()) {
          matchesSearch = true;
        } else {
          matchesSearch =
            searchInValue(entry.timestamp, searchText, isStrictSearch) ||
            searchInValue(entry.type, searchText, isStrictSearch) ||
            searchInValue(entry.message, searchText, isStrictSearch) ||
            searchInValue(entry.status, searchText, isStrictSearch);
        }

        const matchesType =
          selectedTypes.size === 0 || selectedTypes.has(entry.type);

        const matchesErrorFilter =
          !onlyErrors || entry.status === LOG_STATUS.ERROR;

        return matchesSearch && matchesType && matchesErrorFilter;
      }),
    [allEntries, searchText, selectedTypes, isStrictSearch, onlyErrors],
  );

  const errorCount = useMemo(() => {
    return allEntries.filter((entry) => {
      const matchesType =
        selectedTypes.size === 0 || selectedTypes.has(entry.type);
      return matchesType && entry.status === LOG_STATUS.ERROR;
    }).length;
  }, [allEntries, selectedTypes]);

  const filters = Object.values(LOG_TYPE).map((entry) => ({
    value: entry,
    label: toTitleCase(entry),
  }));

  const toggleType = (type: LOG_TYPE) => {
    setSelectedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    if (isAllRowsExpanded) {
      setExpandedRowKeys([]);
      setIsAllRowsExpanded(false);
    } else {
      setExpandedRowKeys(
        filteredEntries.map((entry) => `${entry.timestamp}-${entry.id}`),
      );
      setIsAllRowsExpanded(true);
    }
  };

  const columns: ColumnsType<JsonParserEntry> = [
    {
      title: "",
      key: "errorIcon",
      width: 40,
      render: (_: any, row: JsonParserEntry) =>
        row.status === LOG_STATUS.ERROR ? (
          <BugOutlined style={{ color: COLORS.RED, fontSize: "12px" }} />
        ) : null,
    },
    {
      title: "timestamp",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 260,
      render: (value: string, row: JsonParserEntry) => (
        <Typography.Text code className="mono" style={{ color: row.textColor }}>
          {highlightText(value, searchText, isStrictSearch)}
        </Typography.Text>
      ),
    },
    {
      title: "source",
      dataIndex: "type",
      key: "type",
      width: 170,
      render: (value: LOG_TYPE, row: JsonParserEntry) => (
        <Tag style={{ color: row.textColor }}>
          {highlightText(value, searchText, isStrictSearch)}
        </Tag>
      ),
    },
    {
      title: (
        <Flex justify="space-between" align="center">
          <span>Message</span>
          <Button
            onClick={handleExpandAll}
            shape="round"
            color="primary"
            size="small"
            icon={isAllRowsExpanded ? <UpOutlined /> : <DownOutlined />}
          />
        </Flex>
      ),
      dataIndex: "message",
      key: "message",
      ellipsis: true,
      render: (value: string, row: JsonParserEntry) => (
        <Typography.Text style={{ color: row.textColor }}>
          {highlightText(value, searchText, isStrictSearch, true)}
        </Typography.Text>
      ),
    },
  ];

  const handleUpload = async (file: File) => {
    setError(null);
    try {
      const content = await file.text();
      const entries = JSONLinesParser.parse(content);
      setAllEntries(entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обработать файл");
      setAllEntries([]);
    }
    return false;
  };

  const getLogLevel = (record: JsonParserEntry): string | null => {
    if (record.type === "client_log" || record.type === "browser_log") {
      const level = (record.payload?.level as string) ?? record.status ?? null;
      return level;
    }
    return null;
  };

  const getLevelColor = (level: string): string => {
    const levelLower = level.toLowerCase();
    if (levelLower.includes("error") || level === LOG_STATUS.ERROR) {
      return COLORS.RED;
    } else if (levelLower.includes("success") || level === LOG_STATUS.SUCCESS) {
      return COLORS.DARK;
    } else if (levelLower.includes("info")) {
      return COLORS.BLUE;
    }
    return COLORS.BLUE;
  };

  return (
    <div className="page">
      {!allEntries.length ? (
        <Card className="card" variant="borderless">
          <label
            htmlFor="upload"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              padding: "40px 0",
            }}
          >
            <Empty />
            <Upload
              beforeUpload={handleUpload}
              showUploadList={false}
              accept=".jsonl,.json,.txt"
              id="upload"
            >
              <Button
                type="primary"
                variant="filled"
                size="large"
                icon={<UploadOutlined />}
              >
                Загрузите JSON Lines файл
              </Button>
            </Upload>
          </label>
          {error ? <Alert type="error" message={error} showIcon /> : null}
        </Card>
      ) : (
        <Card className="card">
          <Flex vertical gap={16} style={{ height: "100%" }}>
            <Flex align="center" gap={12}>
              <Upload
                beforeUpload={handleUpload}
                showUploadList={false}
                accept=".jsonl,.json,.txt"
              >
                <Button
                  type="primary"
                  variant="filled"
                  size="large"
                  icon={<UploadOutlined />}
                >
                  Загрузите JSON Lines файл
                </Button>
              </Upload>
              {error ? <Alert type="error" message={error} showIcon /> : null}
              <Input
                allowClear={{
                  clearIcon: <CloseOutlined style={{ fontSize: "16px" }} />,
                }}
                size="large"
                variant="filled"
                placeholder="Введите поисковый запрос"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ flex: 1 }}
              />
              <Space
                style={{ flexShrink: 0, cursor: "pointer", userSelect: "none" }}
                onClick={() => setIsStrictSearch(!isStrictSearch)}
              >
                <span>Строгий поиск:</span>
                <Switch checked={isStrictSearch} onChange={setIsStrictSearch} />
              </Space>
            </Flex>

            <Flex className="filters" gap={8} wrap align="center">
              {filters.map((entry, index) => {
                const active = selectedTypes.has(entry.value);
                return (
                  <Tag.CheckableTag
                    key={index}
                    checked={active}
                    onChange={() => toggleType(entry.value)}
                    icon={
                      active ? (
                        <CheckCircleTwoTone twoToneColor={COLORS.BLUE} />
                      ) : (
                        <CloseCircleTwoTone twoToneColor={COLORS.BLUE} />
                      )
                    }
                    className="filterTag"
                  >
                    {entry.label}
                  </Tag.CheckableTag>
                );
              })}
              <Badge
                count={errorCount}
                overflowCount={99}
                style={{ zIndex: 2 }}
                showZero
              >
                <Button
                  onClick={() => setOnlyErrors(!onlyErrors)}
                  icon={onlyErrors ? <BugFilled /> : <BugOutlined />}
                  danger
                />
              </Badge>
              <Button
                onClick={() => {
                  setSelectedTypes(new Set());
                  setOnlyErrors(false);
                }}
                danger
              >
                Сбросить фильтры
              </Button>
            </Flex>

            <Flex vertical style={{ overflow: "hidden" }} flex={1}>
              <div
                style={{
                  overflow: "auto",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Table<JsonParserEntry>
                  rowKey={(record) => `${record.timestamp}-${record.id}`}
                  columns={columns}
                  dataSource={filteredEntries}
                  size="small"
                  pagination={false}
                  expandable={{
                    expandRowByClick: true,
                    onExpand: (expanded, record) => {
                      const key = `${record.timestamp}-${record.id}`;
                      setExpandedRowKeys((prev) =>
                        expanded
                          ? [...prev, key]
                          : prev.filter((k) => k !== key),
                      );
                    },
                    expandedRowKeys,
                    expandedRowRender: (record) => {
                      if (record.type === "rest_event" && record.payload) {
                        return (
                          <RestEventTabs
                            payload={record.payload as Record<string, unknown>}
                            searchText={searchText}
                            isStrictSearch={isStrictSearch}
                          />
                        );
                      }

                      const jsonString = JSON.stringify(
                        record.type === "browser_log" ||
                          record.type === "client_log"
                          ? (record.payload?.text ?? record.payload)
                          : record.payload,
                        null,
                        2,
                      );

                      const level = getLogLevel(record);

                      return (
                        <Flex
                          vertical
                          style={{
                            overflow: "auto",
                            fontSize: "12px",
                            borderRadius: "4px",
                            wordBreak: "break-all",
                            alignItems: "stretch",
                          }}
                        >
                          {level && (
                            <span
                              style={{
                                color: getLevelColor(level),
                                padding: "2px 6px",
                                border: `1px solid ${getLevelColor(level)}`,
                                borderRadius: "4px",
                                fontSize: "12px",
                                textAlign: "center",
                              }}
                            >
                              {level}
                            </span>
                          )}
                          {renderHighlightedJson(
                            jsonString,
                            searchText,
                            isStrictSearch,
                          )}
                        </Flex>
                      );
                    },
                  }}
                  scroll={{ x: 900 }}
                  sticky
                />
              </div>
            </Flex>
          </Flex>
        </Card>
      )}
    </div>
  );
};

export default App;
