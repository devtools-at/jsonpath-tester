/**
 * JSONPath Tester
 * Test JSONPath expressions
 *
 * Online tool: https://devtools.at/tools/jsonpath-tester
 *
 * @packageDocumentation
 */

function evaluateJsonPath(data: unknown, path: string): { results: unknown[]; error?: string } {
  if (!path.trim()) {
    return { results: [] };
  }

  try {
    // Handle root reference
    if (path === "$" || path === "@") {
      return { results: [data] };
    }

    // Remove leading $ or @
    let normalizedPath = path.startsWith("$") ? path.substring(1) : path;
    normalizedPath = normalizedPath.startsWith("@") ? normalizedPath.substring(1) : normalizedPath;

    // Start with root data
    let current: unknown[] = [data];

    // Split path into segments
    const segments = normalizedPath.match(/\[([^\]]+)\]|\.\.([^.[]+)|\.([^.[]+)/g) || [];

    if (segments.length === 0 && normalizedPath.trim()) {
      // Handle simple property access without dot
      if (typeof data === "object" && data !== null && normalizedPath in data) {
        return { results: [(data as Record<string, unknown>)[normalizedPath]] };
      }
      return { results: [], error: `Property '${normalizedPath}' not found` };
    }

    for (const segment of segments) {
      const next: unknown[] = [];

      for (const item of current) {
        if (segment.startsWith("..")) {
          // Recursive descent
          const key = segment.substring(2);
          const found = recursiveSearch(item, key);
          next.push(...found);
        } else if (segment.startsWith("[")) {
          // Bracket notation
          const content = segment.slice(1, -1);

          if (content === "*") {
            // Wildcard - all elements/properties
            if (Array.isArray(item)) {
              next.push(...item);
            } else if (typeof item === "object" && item !== null) {
              next.push(...Object.values(item));
            }
          } else if (content.match(/^\d+$/)) {
            // Numeric index
            if (Array.isArray(item)) {
              const index = parseInt(content, 10);
              if (index >= 0 && index < item.length) {
                next.push(item[index]);
              }
            }
          } else if (content.includes(":")) {
            // Array slice [start:end]
            if (Array.isArray(item)) {
              const [startStr, endStr] = content.split(":");
              const start = startStr ? parseInt(startStr, 10) : 0;
              const end = endStr ? parseInt(endStr, 10) : item.length;
              next.push(...item.slice(start, end));
            }
          } else if (content.startsWith("?")) {
            // Filter expression (basic support)
            if (Array.isArray(item)) {
              const filtered = item.filter((elem) => evaluateFilter(elem, content));
              next.push(...filtered);
            }
          } else {
            // Property name in brackets
            const key = content.replace(/^['"]|['"]$/g, "");
            if (typeof item === "object" && item !== null && key in item) {
              next.push((item as Record<string, unknown>)[key]);
            }
          }
        } else if (segment.startsWith(".")) {
          // Dot notation
          const key = segment.substring(1);
          if (key === "*") {
            // Wildcard
            if (Array.isArray(item)) {
              next.push(...item);
            } else if (typeof item === "object" && item !== null) {
              next.push(...Object.values(item));
            }
          } else if (typeof item === "object" && item !== null && key in item) {
            next.push((item as Record<string, unknown>)[key]);
          }
        }
      }

      current = next;

      if (current.length === 0) {
        break;
      }
    }

    return { results: current };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { results: [], error: message };
  }
}

function recursiveSearch(obj: unknown, key: string): unknown[] {
  const results: unknown[] = [];

  function search(current: unknown) {
    if (typeof current === "object" && current !== null) {
      if (key in current) {
        results.push((current as Record<string, unknown>)[key]);
      }

      if (Array.isArray(current)) {
        current.forEach(search);
      } else {
        Object.values(current).forEach(search);
      }
    }
  }

  search(obj);
  return results;
}

function evaluateFilter(item: unknown, filter: string): boolean {
  try {
    // Remove leading ?( and trailing )
    const expr = filter.replace(/^\?\(/, "").replace(/\)$/, "");

    // Replace @ with actual reference to item
    // Support basic comparisons: @.prop == value, @.prop > value, etc.
    if (expr.includes("@.")) {
      const match = expr.match(/@\.(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)/);
      if (match && typeof item === "object" && item !== null) {
        const [, prop, op, valueStr] = match;
        const itemValue = (item as Record<string, unknown>)[prop];
        let compareValue: unknown = valueStr.trim().replace(/^['"]|['"]$/g, "");

        // Try to parse as number
        if (!isNaN(Number(compareValue))) {
          compareValue = Number(compareValue);
        }

        switch (op) {
          case "==": return itemValue == compareValue;
          case "!=": return itemValue != compareValue;
          case ">": return (itemValue as number) > (compareValue as number);
          case "<": return (itemValue as number) < (compareValue as number);
          case ">=": return (itemValue as number) >= (compareValue as number);
          case "<=": return (itemValue as number) <= (compareValue as number);
        }
      }
    }

    return true;
  } catch {
    return true;
  }
}

// Export for convenience
export default { encode, decode };
