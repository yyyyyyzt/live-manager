import React from 'react';
import './FormField.css';

interface FormFieldProps {
  label?: React.ReactNode;
  labelWidth?: number;
  requiredMark?: boolean;
  help?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * 轻量表单布局组件 — 仅做 label + 内容的布局，
 * **不劫持** 子组件的 value / onChange（避免 TDesign FormItem 的 cloneElement 问题）。
 */
export function FormField({
  label,
  labelWidth = 100,
  requiredMark = false,
  help,
  children,
  style,
  className,
}: FormFieldProps) {
  return (
    <div className={`form-field${className ? ` ${className}` : ''}`} style={style}>
      {label !== undefined && (
        <div className="form-field__label" style={{ width: labelWidth, minWidth: labelWidth }}>
          <label>
            {requiredMark && <span className="form-field__required">*</span>}
            {label}
          </label>
        </div>
      )}
      <div className="form-field__content">
        <div className="form-field__controls">{children}</div>
        {help && <div className="form-field__help">{help}</div>}
      </div>
    </div>
  );
}

interface FormLayoutProps {
  children: React.ReactNode;
  labelWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 表单容器 — 仅提供垂直堆叠布局，不做任何数据管理。
 */
export function FormLayout({ children, labelWidth, className, style }: FormLayoutProps) {
  return (
    <div className={`form-layout${className ? ` ${className}` : ''}`} style={style}>
      {labelWidth
        ? React.Children.map(children, (child) => {
            if (React.isValidElement<FormFieldProps>(child) && child.type === FormField) {
              return React.cloneElement(child, { labelWidth });
            }
            return child;
          })
        : children}
    </div>
  );
}
