// 上传配置
export interface UploadConfig {
  enabled: boolean;
  provider: string;
  bucket?: string;
  region?: string;
  cdnDomain?: string;
  accessDomain?: string;
}

// 上传结果
export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimetype: string;
  provider: string;
}
