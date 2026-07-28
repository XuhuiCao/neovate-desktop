import { implement } from "@orpc/server";

import type { AppContext } from "../../router";

import { notificationContract } from "../../../shared/features/notification/contract";

const os = implement({ notification: notificationContract }).$context<AppContext>();

export const notificationRouter = os.notification.router({
  show: os.notification.show.handler(({ input, context }) => {
    return context.notificationService.show(input);
  }),

  permission: os.notification.permission.handler(({ context }) => {
    return context.notificationService.permission();
  }),

  requestPermission: os.notification.requestPermission.handler(({ context }) => {
    return context.notificationService.requestPermission();
  }),
});
