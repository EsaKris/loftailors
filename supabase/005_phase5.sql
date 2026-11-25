-- Phase 5. Run AFTER 004_phase4.sql. Cart-style pricing: the 2-for deal repeats, free caps unlock by quantity.
alter table offers add column if not exists caps int not null default 0;
update offers set caps = 1 where q = 3 and caps = 0;
update offers set caps = 2 where q = 5 and caps = 0;
