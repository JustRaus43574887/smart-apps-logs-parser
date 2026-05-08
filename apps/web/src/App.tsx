import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
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
  CloseOutlined,
  DownOutlined,
  UpOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  COLORS,
  JsonParserEntry,
  LOG_TYPE,
  LogEntry,
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
        <span
          key={index}
          style={{ fontWeight: "bold", color: COLORS.DARK_GRAY }}
        >
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
        <pre className="jsonViewer">
          {renderHighlightedJson(
            processJsonString(
              JSON.stringify(payload, null, 2),
              searchText,
              isStrictSearch,
            ),
          )}
        </pre>
      ),
    },
  ];

  // Request tab
  if (payload.request) {
    items.push({
      key: "request",
      label: "request",
      children: (
        <pre className="jsonViewer">
          {renderHighlightedJson(
            processJsonString(
              JSON.stringify(payload.request, null, 2),
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
    items.push({
      key: "response",
      label: "response",
      children: (
        <pre className="jsonViewer">
          {renderHighlightedJson(
            processJsonString(
              JSON.stringify(payload.response, null, 2),
              searchText,
              isStrictSearch,
            ),
          )}
        </pre>
      ),
    });
  }

  // Headers tab
  const headersObj: Record<string, unknown> = {};
  if (
    payload.request &&
    typeof payload.request === "object" &&
    "headers" in payload.request
  ) {
    headersObj["request_headers"] = (
      payload.request as Record<string, unknown>
    ).headers;
  }
  if (
    payload.response &&
    typeof payload.response === "object" &&
    "headers" in payload.response
  ) {
    headersObj["response_headers"] = (
      payload.response as Record<string, unknown>
    ).headers;
  }

  if (Object.keys(headersObj).length > 0) {
    items.push({
      key: "headers",
      label: "headers",
      children: (
        <pre className="jsonViewer">
          {renderHighlightedJson(
            processJsonString(
              JSON.stringify(headersObj, null, 2),
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
      title: "message",
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
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Upload
              beforeUpload={handleUpload}
              showUploadList={false}
              accept=".jsonl,.json,.txt"
            >
              <Button icon={<UploadOutlined />}>Загрузить лог-файл</Button>
            </Upload>
            {error ? <Alert type="error" message={error} showIcon /> : null}
            <Empty />
          </Space>
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
                <Button icon={<UploadOutlined />}>Загрузить лог-файл</Button>
              </Upload>
              {error ? <Alert type="error" message={error} showIcon /> : null}
              <Input
                allowClear
                size="large"
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
                    className="filterTag"
                  >
                    {entry.label}
                    <CloseOutlined style={{ marginLeft: "4px" }} />
                  </Tag.CheckableTag>
                );
              })}
              <Button onClick={() => setSelectedTypes(new Set())} danger>
                Сбросить фильтры
              </Button>
              <Flex
                onClick={() => setIsAllRowsExpanded(!isAllRowsExpanded)}
                align="center"
                gap={8}
              >
                <Button
                  shape="round"
                  color="primary"
                  size="small"
                  icon={isAllRowsExpanded ? <UpOutlined /> : <DownOutlined />}
                />
                {isAllRowsExpanded ? "Свернуть все" : "Развернуть все"}
              </Flex>
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
                    rowKey={(record, _) => `${record.timestamp}-${record.type}`}
                    columns={columns}
                    dataSource={filteredEntries}
                    size="small"
                    pagination={false}
                    expandable={{
                      expandRowByClick: true,
                      onExpand: (expanded, record) => {
                        setExpandedRowKeys((prev) => {
                          const key = `${record.timestamp}-${record.type}`;
                          return expanded
                            ? [...prev, key]
                            : prev.filter((k) => k !== key);
                        });
                      },
                      expandedRowKeys: isAllRowsExpanded
                        ? filteredEntries.map(
                            (entry) => `${entry.timestamp}-${entry.type}`,
                          )
                        : filteredEntries
                            .filter((entry) => {
                              const key = `${entry.timestamp}-${entry.type}`;
                              return expandedRowKeys.includes(key);
                            })
                            .map((entry) => `${entry.timestamp}-${entry.type}`),
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
