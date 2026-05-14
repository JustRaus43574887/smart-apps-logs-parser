import { useMemo, useState } from "react";
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
  Tabs,
  Typography,
  Upload,
  Flex,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  CloseOutlined,
  DownOutlined,
  UpOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  COLORS,
  JsonParserEntry,
  LOG_TYPE,
  LOG_STATUS,
} from "../../../shared/types";
import { JSONLinesParser } from "../../../shared/jsonl-parser";

export const toTitleCase = (text: string) => {
  return text
    .split("_")
    .filter((x) => x.length > 0)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
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

const highlightText = (text: string, searchText: string, isStrict: boolean) => {
  if (!searchText.trim()) {
    return text;
  }

  if (isStrict) {
    return text === searchText ? (
      <mark
        style={{
          backgroundColor: COLORS.YELLOW,
          display: "inline",
          padding: 0,
          margin: 0,
        }}
      >
        {text}
      </mark>
    ) : (
      text
    );
  }

  const parts = text.split(
    new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
  );
  return parts.map((part, index) =>
    part.toLowerCase() === searchText.toLowerCase() ? (
      <mark
        key={index}
        style={{
          backgroundColor: COLORS.YELLOW,
          display: "inline",
          padding: 0,
          margin: 0,
        }}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

const highlightJsonString = (
  jsonString: string,
  searchText: string,
  isStrict: boolean,
): string => {
  if (!searchText.trim()) {
    return jsonString;
  }

  const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, isStrict ? "g" : "gi");
  return jsonString.replace(
    regex,
    (match) => `[HIGHLIGHT_START]${match}[HIGHLIGHT_END]`,
  );
};

const renderHighlightedJson = (jsonString: string) => {
  const parts = jsonString.split(
    /(\[HIGHLIGHT_START\]|\[HIGHLIGHT_END\]|\[KEY_START\]|\[KEY_END\])/,
  );
  return parts.map((part, index) => {
    if (part === "[HIGHLIGHT_START]") return null;
    if (part === "[HIGHLIGHT_END]") return null;
    if (part === "[KEY_START]") return null;
    if (part === "[KEY_END]") return null;

    const isHighlighted = parts[index - 1] === "[HIGHLIGHT_START]";
    const isKey = parts[index - 1] === "[KEY_START]";

    if (isHighlighted) {
      return (
        <mark
          key={index}
          style={{
            backgroundColor: COLORS.YELLOW,
            display: "inline",
            padding: 0,
            margin: 0,
          }}
        >
          {part}
        </mark>
      );
    }

    if (isKey) {
      return (
        <span key={index} style={{ fontWeight: "bold", color: COLORS.DARK }}>
          {part}
        </span>
      );
    }

    return part;
  });
};

const addKeyMarkers = (jsonString: string): string => {
  return jsonString.replace(/"([^"]+)":/g, '[KEY_START]"$1"[KEY_END]:');
};

const processJsonString = (
  jsonString: string,
  searchText: string,
  isStrict: boolean,
): string => {
  let result = jsonString;
  // First add key markers
  result = addKeyMarkers(result);
  // Then add highlight markers
  result = highlightJsonString(result, searchText, isStrict);
  return result;
};

const getRestEventTabs = (
  payload: Record<string, unknown>,
  searchText: string,
  isStrictSearch: boolean,
) => {
  const items: any[] = [
    {
      key: "general",
      label: "general",
      children: (
        <Descriptions
          column={1}
          size="small"
          items={[
            {
              key: "url",
              label: "URL",
              children: payload.url || "-",
            },
            {
              key: "method",
              label: "Method",
              children: payload.method || "-",
            },
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
  ];

  // Headers tab (second tab)
  const requestHeaders =
    payload.request &&
    typeof payload.request === "object" &&
    "headers" in payload.request
      ? (payload.request as Record<string, unknown>).headers
      : null;

  const responseHeaders =
    payload.response &&
    typeof payload.response === "object" &&
    "headers" in payload.response
      ? (payload.response as Record<string, unknown>).headers
      : null;

  if (requestHeaders || responseHeaders) {
    items.push({
      key: "headers",
      label: "headers",
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {requestHeaders && (
            <div>
              <h4 style={{ margin: "0 0 12px 0", fontWeight: 600 }}>
                Request Headers
              </h4>
              <Descriptions
                column={2}
                size="small"
                items={
                  typeof requestHeaders === "object" && requestHeaders !== null
                    ? Object.entries(requestHeaders).map(([key, value]) => ({
                        key,
                        label: key,
                        children: String(value || "-"),
                      }))
                    : []
                }
              />
            </div>
          )}
          {responseHeaders && (
            <div>
              <h4 style={{ margin: "0 0 12px 0", fontWeight: 600 }}>
                Response Headers
              </h4>
              <Descriptions
                column={2}
                size="small"
                items={
                  typeof responseHeaders === "object" &&
                  responseHeaders !== null
                    ? Object.entries(responseHeaders).map(([key, value]) => ({
                        key,
                        label: key,
                        children: String(value || "-"),
                      }))
                    : []
                }
              />
            </div>
          )}
        </div>
      ),
    });
  }

  // Request tab
  if (payload.request) {
    const requestBody = (payload.request as Record<string, unknown>).body;
    items.push({
      key: "request",
      label: "request",
      children: (
        <pre className="jsonViewer">
          {renderHighlightedJson(
            processJsonString(
              JSON.stringify(requestBody || {}, null, 2),
              searchText,
              isStrictSearch,
            ),
          )}
        </pre>
      ),
    });
  }

  // Response tab
  if (payload.response) {
    const responseBody = (payload.response as Record<string, unknown>).body;
    items.push({
      key: "response",
      label: "response",
      children: (
        <pre className="jsonViewer">
          {renderHighlightedJson(
            processJsonString(
              JSON.stringify(responseBody || {}, null, 2),
              searchText,
              isStrictSearch,
            ),
          )}
        </pre>
      ),
    });
  }

  return items;
};

const App = () => {
  const [allEntries, setAllEntries] = useState<JsonParserEntry[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<LOG_TYPE>>(new Set());
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
            searchInValue(entry.payload, searchText, isStrictSearch);
        }

        const matchesType =
          selectedTypes.size === 0 || selectedTypes.has(entry.type);
        return matchesSearch && matchesType;
      }),
    [allEntries, searchText, selectedTypes, isStrictSearch],
  );

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

  const columns: ColumnsType<JsonParserEntry> = [
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
            onClick={() => setIsAllRowsExpanded(!isAllRowsExpanded)}
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
          {highlightText(value, searchText, isStrictSearch)}
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
              <Space style={{ flexShrink: 0 }}>
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
              <Button onClick={() => setSelectedTypes(new Set())} danger>
                Сбросить фильтры
              </Button>
            </Flex>
            <Flex vertical style={{ overflow: "hidden" }} flex={1}>
              {allEntries.length === 0 && !error ? (
                <Empty description="Загрузите JSON Lines файл" />
              ) : (
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
                        setExpandedRowKeys((prev) => {
                          const key = `${record.timestamp}-${record.id}`;
                          return expanded
                            ? [...prev, key]
                            : prev.filter((k) => k !== key);
                        });
                      },
                      expandedRowKeys: isAllRowsExpanded
                        ? filteredEntries.map(
                            (entry) => `${entry.timestamp}-${entry.id}}`,
                          )
                        : filteredEntries
                            .filter((entry) => {
                              const key = `${entry.timestamp}-${entry.id}`;
                              return expandedRowKeys.includes(key);
                            })
                            .map((entry) => `${entry.timestamp}-${entry.id}`),
                      expandedRowRender: (record) => {
                        // Special handling for rest_event
                        if (record.type === "rest_event" && record.payload) {
                          const items = getRestEventTabs(
                            record.payload as Record<string, unknown>,
                            searchText,
                            isStrictSearch,
                          );
                          return <Tabs size="small" items={items} />;
                        }

                        // Special handling for client_log and browser_log
                        if (
                          record.type === "client_log" ||
                          record.type === "browser_log"
                        ) {
                          // Determine level from payload.level or fallback to status
                          const level =
                            (record.payload?.level as string) || record.status;
                          const levelLower = level.toLowerCase();
                          let levelColor = COLORS.DARK;
                          if (
                            levelLower.includes("error") ||
                            levelLower === "error" ||
                            level === LOG_STATUS.ERROR
                          ) {
                            levelColor = COLORS.RED;
                          } else if (
                            levelLower.includes("success") ||
                            level === LOG_STATUS.SUCCESS
                          ) {
                            levelColor = COLORS.DARK;
                          } else if (levelLower.includes("info")) {
                            levelColor = COLORS.BLUE;
                          }

                          return (
                            <div
                              style={{
                                position: "relative",
                                whiteSpace: "pre-wrap",
                                overflow: "auto",
                                fontFamily: "monospace",
                                fontSize: "12px",
                                backgroundColor: COLORS.LIGHT,
                                padding: "12px",
                                paddingRight: "80px",
                                borderRadius: "4px",
                                wordBreak: "break-word",
                              }}
                            >
                              <Tag
                                style={{
                                  position: "absolute",
                                  top: "12px",
                                  right: "12px",
                                  margin: 0,
                                }}
                                color={levelColor}
                              >
                                {level}
                              </Tag>
                              {highlightText(
                                record.payload.text as string,
                                searchText,
                                isStrictSearch,
                              )}
                            </div>
                          );
                        }

                        // Default payload rendering for other types
                        const jsonString = JSON.stringify(
                          record.payload,
                          null,
                          2,
                        );
                        const highlightedJson = processJsonString(
                          jsonString,
                          searchText,
                          isStrictSearch,
                        );

                        return (
                          <pre className="jsonViewer">
                            {renderHighlightedJson(highlightedJson)}
                          </pre>
                        );
                      },
                    }}
                    scroll={{ x: 900 }}
                  />
                </div>
              )}
            </Flex>
          </Flex>
        </Card>
      )}
    </div>
  );
};

export default App;
