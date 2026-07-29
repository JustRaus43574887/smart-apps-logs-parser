import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  Fragment,
} from "react";
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
  Modal,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  CloseOutlined,
  DownOutlined,
  UpOutlined,
  UploadOutlined,
  BugOutlined,
  BugFilled,
  ExclamationOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import JSZip from "jszip";
import {
  COLORS,
  JsonParserEntry,
  LOG_TYPE,
  LOG_STATUS,
} from "../../../common/types";
import { JSONLinesParser } from "../../../common/jsonParser";
import { CollapseProps } from "antd/lib";

export const toTitleCase = (text: string) => {
  return text
    .split("_")
    .filter((x) => x.length > 0)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
};

const LOG_FILE_EXT = /\.(jsonl|json|txt)$/i;
const IMAGE_FILE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;
const ZIP_MIME = /zip|octet-stream/i;
const UPLOAD_ACCEPT = ".jsonl,.json,.txt,.zip";
const SEARCH_DEBOUNCE_MS = 200;

const FILTERS = Object.values(LOG_TYPE).map((entry) => ({
  value: entry,
  label: toTitleCase(entry),
}));

const isZipFile = (file: File) =>
  file.name.toLowerCase().endsWith(".zip") || ZIP_MIME.test(file.type);

const getEntryKey = (entry: JsonParserEntry) =>
  `${entry.timestamp}-${entry.id}`;

const VISIBLE_SEARCH_FIELDS = [
  "timestamp",
  "type",
  "message",
  "status",
] as const;

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

  if (isStrict) {
    // Exact field value: quoted string or bare token equal to the query
    const regex = new RegExp(
      `(")${escaped}(")|(?<![\\w.-])${escaped}(?![\\w.-])`,
      "g",
    );
    return jsonString.replace(regex, (match, q1, q2) => {
      if (q1 && q2) {
        return `${q1}[HIGHLIGHT_START]${searchText}[HIGHLIGHT_END]${q2}`;
      }
      return `[HIGHLIGHT_START]${match}[HIGHLIGHT_END]`;
    });
  }

  const regex = new RegExp(escaped, "gi");
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
  searchLower: string,
): boolean => {
  if (typeof value === "string") {
    return isStrict
      ? value === searchText
      : value.toLowerCase().includes(searchLower);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const asString = String(value);
    return isStrict
      ? asString === searchText
      : asString.toLowerCase().includes(searchLower);
  }
  if (Array.isArray(value)) {
    return value.some((val) =>
      searchInValue(val, searchText, isStrict, searchLower),
    );
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(
      ([key, val]) =>
        searchInValue(key, searchText, isStrict, searchLower) ||
        searchInValue(val, searchText, isStrict, searchLower),
    );
  }
  return false;
};

const searchInEntry = (
  entry: JsonParserEntry,
  searchText: string,
  isStrict: boolean,
  searchLower: string,
): boolean => {
  // Skip synthetic fields — search only log data
  if (
    searchInValue(entry.timestamp, searchText, isStrict, searchLower) ||
    searchInValue(entry.type, searchText, isStrict, searchLower) ||
    searchInValue(entry.message, searchText, isStrict, searchLower) ||
    searchInValue(entry.status, searchText, isStrict, searchLower)
  ) {
    return true;
  }
  return searchInValue(entry.payload, searchText, isStrict, searchLower);
};

const matchInVisibleFields = (
  entry: JsonParserEntry,
  searchText: string,
  isStrict: boolean,
  searchLower: string,
): boolean =>
  VISIBLE_SEARCH_FIELDS.some((field) =>
    searchInValue(entry[field], searchText, isStrict, searchLower),
  );

const matchOnlyInHiddenFields = (
  entry: JsonParserEntry,
  searchText: string,
  isStrict: boolean,
  searchLower: string,
): boolean => {
  if (!searchText) return false;
  if (matchInVisibleFields(entry, searchText, isStrict, searchLower)) {
    return false;
  }
  return searchInValue(entry.payload, searchText, isStrict, searchLower);
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

const RestEventTabs = memo(function RestEventTabs({
  payload,
  searchText,
  isStrictSearch,
}: {
  payload: Record<string, any>;
  searchText: string;
  isStrictSearch: boolean;
}) {
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

  const handleExpandAllCollapse = useCallback(() => {
    setExpandedKeys((prev) => (prev.length > 0 ? [] : allExpandedKeys));
  }, []);

  const restItems: CollapseProps["items"] = useMemo(
    () => [
      {
        key: "general",
        label: "General",
        children: (
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: "url", label: "URL", children: payload.url || "-" },
              {
                key: "method",
                label: "Method",
                children: payload.method || "-",
              },
              {
                key: "status_code",
                label: "Status Code",
                children: payload.status_code ?? "-",
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
                  items={Object.entries(responseHeaders).map(
                    ([key, value]) => ({
                      key,
                      label: key,
                      children: String(value || "-"),
                    }),
                  )}
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
    ],
    [
      payload,
      requestHeaders,
      responseHeaders,
      searchText,
      isStrictSearch,
    ],
  );

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
});

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
  }
  if (levelLower.includes("success") || level === LOG_STATUS.SUCCESS) {
    return COLORS.DARK;
  }
  return COLORS.BLUE;
};

const App = () => {
  const [allEntries, setAllEntries] = useState<JsonParserEntry[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<LOG_TYPE>>(new Set());
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStrictSearch, setIsStrictSearch] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [tableBodyHeight, setTableBodyHeight] = useState<number>(400);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const screenshotUrlRef = useRef<string | null>(null);

  const revokeScreenshot = useCallback(() => {
    if (screenshotUrlRef.current) {
      URL.revokeObjectURL(screenshotUrlRef.current);
      screenshotUrlRef.current = null;
    }
    setScreenshotUrl(null);
  }, []);

  const setScreenshotFromBlob = useCallback(
    (blob: Blob) => {
      revokeScreenshot();
      const url = URL.createObjectURL(blob);
      screenshotUrlRef.current = url;
      setScreenshotUrl(url);
    },
    [revokeScreenshot],
  );

  useEffect(() => {
    return () => {
      if (screenshotUrlRef.current) {
        URL.revokeObjectURL(screenshotUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const trimmed = searchInput.trim();
    const timer = window.setTimeout(() => {
      setSearchText(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    const updateHeight = () => {
      const height = el.clientHeight;
      setTableBodyHeight((prev) => {
        const next = Math.max(120, height - 39);
        return prev === next ? prev : next;
      });
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [allEntries.length]);

  const searchLower = useMemo(() => searchText.toLowerCase(), [searchText]);

  const filteredEntries = useMemo(() => {
    const hasSearch = searchText.length > 0;
    const hasTypeFilter = selectedTypes.size > 0;

    return allEntries.filter((entry) => {
      if (hasTypeFilter && !selectedTypes.has(entry.type)) return false;
      if (onlyErrors && entry.status !== LOG_STATUS.ERROR) return false;
      if (
        hasSearch &&
        !searchInEntry(entry, searchText, isStrictSearch, searchLower)
      ) {
        return false;
      }
      return true;
    });
  }, [
    allEntries,
    searchText,
    searchLower,
    selectedTypes,
    isStrictSearch,
    onlyErrors,
  ]);

  const expandedRowKeySet = useMemo(
    () => new Set(expandedRowKeys),
    [expandedRowKeys],
  );

  const isAllRowsExpanded = useMemo(
    () =>
      filteredEntries.length > 0 &&
      filteredEntries.every((entry) =>
        expandedRowKeySet.has(getEntryKey(entry)),
      ),
    [filteredEntries, expandedRowKeySet],
  );

  const hiddenMatchKeys = useMemo(() => {
    if (!searchText) return new Set<string>();
    const keys = new Set<string>();
    for (const entry of filteredEntries) {
      const key = getEntryKey(entry);
      if (expandedRowKeySet.has(key)) continue;
      if (
        matchOnlyInHiddenFields(entry, searchText, isStrictSearch, searchLower)
      ) {
        keys.add(key);
      }
    }
    return keys;
  }, [
    filteredEntries,
    searchText,
    searchLower,
    isStrictSearch,
    expandedRowKeySet,
  ]);

  const errorCount = useMemo(() => {
    const hasTypeFilter = selectedTypes.size > 0;
    let count = 0;
    for (const entry of allEntries) {
      if (hasTypeFilter && !selectedTypes.has(entry.type)) continue;
      if (entry.status === LOG_STATUS.ERROR) count += 1;
    }
    return count;
  }, [allEntries, selectedTypes]);

  const toggleType = useCallback((type: LOG_TYPE) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedRowKeys((prev) => {
      const allKeys = filteredEntries.map(getEntryKey);
      const allOpen =
        allKeys.length > 0 && allKeys.every((key) => prev.includes(key));
      return allOpen ? [] : allKeys;
    });
  }, [filteredEntries]);

  const columns: ColumnsType<JsonParserEntry> = useMemo(
    () => [
      {
        title: "",
        key: "errorIcon",
        width: 40,
        render: (_: unknown, row: JsonParserEntry) =>
          row.status === LOG_STATUS.ERROR ? (
            <BugOutlined style={{ color: COLORS.RED, fontSize: "12px" }} />
          ) : null,
      },
      {
        title: "timestamp",
        dataIndex: "timestamp",
        key: "timestamp",
        width: 200,
        ellipsis: true,
        render: (value: string, row: JsonParserEntry) => (
          <Typography.Text
            code
            className="mono"
            style={{ color: row.textColor, wordBreak: "break-all" }}
          >
            {highlightText(value, searchText, isStrictSearch)}
          </Typography.Text>
        ),
      },
      {
        title: "source",
        dataIndex: "type",
        key: "type",
        width: 140,
        ellipsis: true,
        render: (value: LOG_TYPE, row: JsonParserEntry) => (
          <Tag style={{ color: row.textColor, maxWidth: "100%" }}>
            {highlightText(value, searchText, isStrictSearch)}
          </Tag>
        ),
      },
      {
        title: (
          <Flex justify="space-between" align="center">
            <span>Message</span>
            {filteredEntries.length > 0 ? (
              <Tooltip
                title={isAllRowsExpanded ? "Закрыть все" : "Раскрыть все"}
                mouseEnterDelay={1}
              >
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExpandAll();
                  }}
                  shape="round"
                  color="primary"
                  size="small"
                  icon={isAllRowsExpanded ? <UpOutlined /> : <DownOutlined />}
                />
              </Tooltip>
            ) : null}
          </Flex>
        ),
        dataIndex: "message",
        key: "message",
        ellipsis: true,
        render: (value: string, row: JsonParserEntry) => (
          <Typography.Text
            style={{ color: row.textColor, wordBreak: "break-word" }}
          >
            {highlightText(value, searchText, isStrictSearch, true)}
          </Typography.Text>
        ),
      },
      {
        title: "",
        key: "hiddenMatch",
        width: 40,
        align: "center",
        render: (_: unknown, row: JsonParserEntry) => {
          if (!hiddenMatchKeys.has(getEntryKey(row))) return null;
          return (
            <Tooltip title="найдено совпадание" mouseEnterDelay={1}>
              <span className="hiddenMatchIcon" style={{ color: COLORS.DARK }}>
                <ExclamationOutlined />
              </span>
            </Tooltip>
          );
        },
      },
    ],
    [
      searchText,
      isStrictSearch,
      filteredEntries.length,
      isAllRowsExpanded,
      handleExpandAll,
      hiddenMatchKeys,
    ],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      setScreenshotOpen(false);
      revokeScreenshot();
      setExpandedRowKeys([]);
      setSearchInput("");
      setSearchText("");
      setSelectedTypes(new Set());
      setOnlyErrors(false);
      setIsStrictSearch(false);

      try {
        let content: string;

        if (isZipFile(file)) {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.values(zip.files).filter((f) => !f.dir);
          const logFiles = entries
            .filter((f) => LOG_FILE_EXT.test(f.name))
            .sort((a, b) => a.name.localeCompare(b.name));
          const imageFile = entries
            .filter((f) => IMAGE_FILE_EXT.test(f.name))
            .sort((a, b) => a.name.localeCompare(b.name))[0];

          if (logFiles.length === 0) {
            throw new Error("В ZIP не найден файл .jsonl / .json / .txt");
          }

          const parts = await Promise.all(
            logFiles.map((f) => f.async("string")),
          );
          content = parts.join("\n");

          if (imageFile) {
            const blob = await imageFile.async("blob");
            const ext = imageFile.name.split(".").pop()?.toLowerCase() ?? "png";
            const mime =
              ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : `image/${ext}`;
            setScreenshotFromBlob(new Blob([blob], { type: mime }));
          }
        } else {
          content = await file.text();
        }

        const parsed = JSONLinesParser.parse(content);
        setAllEntries(parsed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось обработать файл");
        setAllEntries([]);
        revokeScreenshot();
      }
      return false;
    },
    [revokeScreenshot, setScreenshotFromBlob],
  );

  const onRowExpand = useCallback(
    (expanded: boolean, record: JsonParserEntry) => {
      const key = getEntryKey(record);
      setExpandedRowKeys((prev) => {
        if (expanded) {
          return prev.includes(key) ? prev : [...prev, key];
        }
        return prev.filter((k) => k !== key);
      });
    },
    [],
  );

  const rowClassName = useCallback(
    (record: JsonParserEntry) =>
      expandedRowKeySet.has(getEntryKey(record)) ? "row-is-expanded" : "",
    [expandedRowKeySet],
  );

  const expandable: TableProps<JsonParserEntry>["expandable"] = useMemo(
    () => ({
      expandRowByClick: true,
      onExpand: onRowExpand,
      expandedRowKeys,
      expandedRowRender: (record: JsonParserEntry) => {
        if (
          record.type === LOG_TYPE.CLIENT_REST_EVENT ||
          (record.type === LOG_TYPE.APP_REST_EVENT && record.payload)
        ) {
          return (
            <RestEventTabs
              payload={record.payload as Record<string, unknown>}
              searchText={searchText}
              isStrictSearch={isStrictSearch}
            />
          );
        }

        const jsonString = JSON.stringify(
          record.type === "browser_log" || record.type === "client_log"
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
            {renderHighlightedJson(jsonString, searchText, isStrictSearch)}
          </Flex>
        );
      },
    }),
    [expandedRowKeys, onRowExpand, searchText, isStrictSearch],
  );

  const emptyLocale = useMemo(
    () => ({
      emptyText: (
        <div className="tableEmpty" style={{ height: tableBodyHeight }}>
          <Empty description="Нет данных" />
        </div>
      ),
    }),
    [tableBodyHeight],
  );

  const tableScroll = useMemo(
    () => ({ y: tableBodyHeight }),
    [tableBodyHeight],
  );

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
              accept={UPLOAD_ACCEPT}
              id="upload"
            >
              <Button
                type="primary"
                variant="filled"
                size="large"
                icon={<UploadOutlined />}
              >
                Загрузите JSON Lines или ZIP
              </Button>
            </Upload>
          </label>
          {error ? <Alert type="error" message={error} showIcon /> : null}
        </Card>
      ) : (
        <Card className="card">
          <Flex vertical gap={16} style={{ height: "100%", minHeight: 0 }}>
            <Flex align="center" gap={12} wrap className="toolbar">
              <Upload
                beforeUpload={handleUpload}
                showUploadList={false}
                accept={UPLOAD_ACCEPT}
              >
                <Button
                  type="primary"
                  variant="filled"
                  size="large"
                  icon={<UploadOutlined />}
                >
                  Загрузите JSON Lines или ZIP
                </Button>
              </Upload>
              {screenshotUrl ? (
                <Button
                  icon={<CameraOutlined />}
                  onClick={() => setScreenshotOpen(true)}
                  aria-label="Screenshot"
                />
              ) : null}
              {error ? <Alert type="error" message={error} showIcon /> : null}
              <Input
                allowClear={{
                  clearIcon: <CloseOutlined style={{ fontSize: "16px" }} />,
                }}
                size="large"
                variant="filled"
                placeholder="Введите поисковый запрос"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
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
              {FILTERS.map((entry) => {
                const active = selectedTypes.has(entry.value);
                return (
                  <Tag.CheckableTag
                    key={entry.value}
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

            <div className="tableContainer" ref={tableContainerRef}>
              <Table<JsonParserEntry>
                rowKey={getEntryKey}
                columns={columns}
                dataSource={filteredEntries}
                size="small"
                pagination={false}
                locale={emptyLocale}
                expandable={expandable}
                rowClassName={rowClassName}
                scroll={tableScroll}
              />
            </div>
          </Flex>
        </Card>
      )}

      <Modal
        open={screenshotOpen}
        onCancel={() => setScreenshotOpen(false)}
        focusTriggerAfterClose={false}
        footer={null}
        width="100vw"
        centered
        destroyOnClose
        className="screenshotModal"
        styles={{
          body: {
            padding: 0,
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
          },
          content: {
            padding: 0,
            maxWidth: "100vw",
            height: "100vh",
            borderRadius: 0,
            overflow: "hidden",
          },
          mask: { background: "rgba(0,0,0,0.85)" },
        }}
        closeIcon={
          <CloseOutlined style={{ color: "#fff", fontSize: 20 }} />
        }
      >
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt="Screenshot"
            style={{
              maxWidth: "100%",
              maxHeight: "100vh",
              objectFit: "contain",
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
};

export default App;
