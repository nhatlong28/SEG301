
import { pgTable, serial, text, integer, bigint, boolean, timestamp, jsonb, decimal, uuid, primaryKey } from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
    id: serial("id").primaryKey(),
    name: text("name").unique(),
    baseUrl: text("base_url"),
    type: text("type"),
    description: text("description"),
    isActive: boolean("is_active").default(true),
    apiKey: text("api_key"),
    rateLimitRps: integer("rate_limit_rps").default(1),
    proxyUrl: text("proxy_url"),
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    totalItemsCrawled: bigint("total_items_crawled", { mode: "bigint" }).default(0n),
    config: jsonb("config").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const brands = pgTable("brands", {
    id: serial("id").primaryKey(),
    name: text("name").unique().notNull(),
    slug: text("slug").unique().notNull(),
    logoUrl: text("logo_url"),
    isVerified: boolean("is_verified").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const categories = pgTable("categories", {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    level: integer("level").default(1),
    path: text("path"),
    icon: text("icon"),
    isActive: boolean("is_active").default(true),
    sourceId: integer("source_id"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const crawlKeywords = pgTable("crawl_keywords", {
    id: serial("id").primaryKey(),
    keyword: text("keyword").unique().notNull(),
    category: text("category"),
    priority: integer("priority").default(1),
    isActive: boolean("is_active").default(true),
    appliesTo: text("applies_to").array(),
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    url: text("url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const rawProducts = pgTable("raw_products", {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").references(() => sources.id),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url"),
    name: text("name"),
    nameNormalized: text("name_normalized"),
    price: bigint("price", { mode: "bigint" }),
    imageUrl: text("image_url"),
    brandRaw: text("brand_raw"),
    categoryRaw: text("category_raw"),
    attributes: jsonb("attributes"),
    metadata: jsonb("metadata"),
    hashName: text("hash_name"),
    crawledAt: timestamp("crawled_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    lastDedupAt: timestamp("last_dedup_at", { withTimezone: true }),
    dedupStatus: text("dedup_status"),
});
