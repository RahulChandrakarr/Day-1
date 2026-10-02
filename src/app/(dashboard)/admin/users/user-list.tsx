"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Profile } from "@/lib/auth";

export default function UserList({ users }: { users: Profile[] }) {
  return (
    <ul className="flex flex-col gap-3">
      <AnimatePresence initial={true}>
        {users.map((user, i) => (
          <motion.li
            key={user.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: i * 0.05,
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex items-center gap-4 rounded-inset border border-paper/10 bg-paper/[0.03] p-4"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ember/15 font-bold tracking-tight text-xl text-ember">
              {(user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {user.full_name || user.email.split("@")[0]}
              </p>
              <p className="truncate text-sm text-paper/50">{user.email}</p>
            </div>
            <span
              className={
                user.role === "admin"
                  ? "rounded-full bg-ember px-2.5 py-0.5 text-xs font-medium text-on-ember"
                  : "rounded-full border border-paper/15 px-2.5 py-0.5 text-xs text-paper/60"
              }
            >
              {user.role}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
