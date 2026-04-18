const AVATAR_KEYS = [
  'avatarUrl',
  'AvatarUrl',
  'avatar',
  'Avatar',
  'userAvatar',
  'ownerAvatar',
  'hostAvatar',
  'liveOwnerAvatar',
  'liveOwnerAvatarUrl',
  'anchorAvatar',
  'anchorAvatarUrl',
  'portrait',
  'faceUrl',
  'faceURL',
] as const;

const NAME_KEYS = [
  'userName',
  'UserName',
  'nameCard',
  'name',
  'nickname',
  'nickName',
  'OwnerName',
  'ownerName',
  'Owner_Account',
  'ownerAccount',
  'anchorName',
  'anchorId',
  'userId',
  'UserId',
  'id',
] as const;

const CUSTOM_INFO_KEYS = [
  ...AVATAR_KEYS,
  'hostAvatarUrl',
  'ownerAvatarUrl',
  '主播头像',
] as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readFirstString(
  source: UnknownRecord | null,
  keys: readonly string[]
): string {
  if (!source) return '';

  for (const key of keys) {
    const value = getStringValue(source[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

function parseMaybeRecord(value: unknown): UnknownRecord | null {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

function getNestedSources(source: UnknownRecord): Array<UnknownRecord | null> {
  return [
    parseMaybeRecord(source.liveOwner),
    parseMaybeRecord(source.anchor),
    parseMaybeRecord(source.owner),
    parseMaybeRecord(source.host),
    parseMaybeRecord(source.userInfo),
    parseMaybeRecord(source.sender),
  ];
}

export function getFallbackInitial(name?: string): string {
  const value = (name || '').trim();
  return value ? value.charAt(0).toUpperCase() : '?';
}

export function resolveAnchorAvatarUrl(source: unknown): string {
  if (!isRecord(source)) {
    return '';
  }

  const directAvatar = readFirstString(source, AVATAR_KEYS);
  if (directAvatar) {
    return directAvatar;
  }

  for (const nestedSource of getNestedSources(source)) {
    const nestedAvatar = readFirstString(nestedSource, AVATAR_KEYS);
    if (nestedAvatar) {
      return nestedAvatar;
    }
  }

  const customInfo = parseMaybeRecord(
    source.CustomINFO ?? source.customInfo ?? source.customData ?? source.metadata
  );

  return readFirstString(customInfo, CUSTOM_INFO_KEYS);
}

export function resolveAnchorDisplayName(source: unknown, fallback = ''): string {
  if (typeof source === 'string') {
    const value = source.trim();
    return value || fallback;
  }

  if (!isRecord(source)) {
    return fallback;
  }

  const directName = readFirstString(source, NAME_KEYS);
  if (directName) {
    return directName;
  }

  const directLiveOwner = getStringValue(source.liveOwner);
  if (directLiveOwner) {
    return directLiveOwner;
  }

  for (const nestedSource of getNestedSources(source)) {
    const nestedName = readFirstString(nestedSource, NAME_KEYS);
    if (nestedName) {
      return nestedName;
    }
  }

  return fallback;
}
