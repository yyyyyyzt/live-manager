/**
 * 包装 react-router-dom 的 useNavigate，自动附加 URL 覆盖参数。
 * 用法与 useNavigate 完全一致，只需将 import 改为从此文件导入。
 */
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';
import { useCallback } from 'react';
import { getUrlOverrideQuery } from '@live-manager/common';

type NavigateFunction = ReturnType<typeof useNavigate>;

/**
 * 给路径字符串附加 URL 覆盖参数
 */
function appendOverrideToString(path: string): string {
  const query = getUrlOverrideQuery();
  if (!query) return path;

  const [basePath, existingQuery] = path.split('?');
  if (existingQuery) {
    return `${basePath}?${existingQuery}&${query}`;
  }
  return `${basePath}?${query}`;
}

export function useAppNavigate(): NavigateFunction {
  const navigate = useNavigate();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      // navigate(-1) 等数字回退不需要处理
      if (typeof to === 'number') {
        return navigate(to);
      }

      // 字符串路径
      if (typeof to === 'string') {
        return navigate(appendOverrideToString(to), options);
      }

      // 对象形式 { pathname, search, hash }
      if (typeof to === 'object' && to.pathname) {
        const query = getUrlOverrideQuery();
        if (query) {
          const existingSearch = to.search || '';
          return navigate(
            {
              ...to,
              search: existingSearch ? `${existingSearch}&${query}` : `?${query}`,
            },
            options,
          );
        }
      }

      return navigate(to, options);
    },
    [navigate],
  ) as NavigateFunction;
}
