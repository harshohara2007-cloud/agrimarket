import Database from 'better-sqlite3';
export const db = new Database(process.env.DB_FILE || 'krishimarket.db');
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
db.exec(`
create table if not exists users(id integer primary key, phone text unique not null, role text not null check(role in('farmer','buyer')), created_at text default current_timestamp);
create table if not exists otp_state(phone text primary key, last_sent integer default 0, send_count integer default 0, window_start integer default 0, fails integer default 0, locked_until integer default 0);
create table if not exists listings(id integer primary key, farmer_id integer not null references users(id), crop text not null, quantity_kg real not null check(quantity_kg>0), price_per_kg real not null check(price_per_kg>0), state text, district text, market text, status text default 'active', created_at text default current_timestamp);
create table if not exists listing_images(id integer primary key, listing_id integer not null references listings(id) on delete cascade, uploader_id integer not null, file text not null, mime text, size integer, created_at text default current_timestamp);
create table if not exists mandi_prices(id integer primary key, state text, district text, market text, commodity text, variety text, grade text, arrival_date text not null, min_price real, max_price real, modal_price real, unique(state,district,market,commodity,variety,grade,arrival_date));
create index if not exists idx_mp on mandi_prices(commodity,market,arrival_date);
create table if not exists sync_log(id integer primary key, at text default current_timestamp, inserted integer, ok integer, note text);
create table if not exists orders(id integer primary key, buyer_id integer not null, listing_id integer not null, quantity_kg real not null, amount_paise integer not null, status text default 'pending', rzp_order_id text unique, rzp_payment_id text unique, created_at text default current_timestamp);
`);
