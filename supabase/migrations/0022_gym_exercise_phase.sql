alter table gym_plan_exercises
add column phase text not null default 'main' check (phase in ('warmup', 'main', 'cooldown'));
