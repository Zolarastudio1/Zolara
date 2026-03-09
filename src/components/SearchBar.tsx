// components/CollapsibleSearchBar.tsx
import { useState, useEffect, useRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";

interface CollapsibleSearchBarProps<T> {
  data: T[];
  placeholder?: string;
  onSearchResults: (results: T[]) => void;
}

export function CollapsibleSearchBar<T extends Record<string, any>>({
  data,
  placeholder = "Search...",
  onSearchResults,
}: CollapsibleSearchBarProps<T>) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recursive search function
  const searchItem = (item: any, searchQuery: string): boolean => {
    if (item == null) return false;

    if (typeof item === "string" || typeof item === "number") {
      return item.toString().toLowerCase().includes(searchQuery);
    }

    if (Array.isArray(item)) {
      return item.some((subItem) => searchItem(subItem, searchQuery));
    }

    if (typeof item === "object") {
      return Object.values(item).some((value) =>
        searchItem(value, searchQuery)
      );
    }

    return false;
  };

  useEffect(() => {
    if (!query) {
      onSearchResults(data);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = data.filter((item) => searchItem(item, lowerQuery));

    onSearchResults(filtered);
  }, [query, data, onSearchResults]);

  // Focus input when expanded
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className="relative flex items-center">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <SearchIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      ) : (
        <div className="flex items-center border rounded-full bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 px-3 py-1 w-64 transition-all">
          <SearchIcon className="w-5 h-5 text-gray-400 mr-2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-gray-800 dark:text-gray-200"
          />
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <XIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      )}
    </div>
  );
}
