/**
 * نقطة الوصول الوحيدة لطبقة التخزين — اتجاه التصميم: "دفتر الميناء"
 * الشاشات تستورد `db` فقط. لتحويل التطبيق إلى SQLite يتم تغيير السطر أدناه وحده.
 */

import { indexedDbRepository } from "./indexedDbRepository";
import type { Repository } from "./repository";

export const db: Repository = indexedDbRepository;
export const STORAGE_ENGINE = "IndexedDB" as const;

export * from "./schema";
export type { BackupPayload, Repository } from "./repository";
