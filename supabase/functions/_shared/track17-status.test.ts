import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describeTrack17Status, statusCanAdvance } from "./track17-status.ts";

Deno.test("normalizes core 17TRACK statuses", () => {
  assertEquals(describeTrack17Status("InfoReceived").normalized, "information_received");
  assertEquals(describeTrack17Status("InTransit").normalized, "in_transit");
  assertEquals(describeTrack17Status("OutForDelivery").normalized, "out_for_delivery");
  assertEquals(describeTrack17Status("DeliveryFailure").normalized, "delivery_failed");
  assertEquals(describeTrack17Status("Delivered").normalized, "delivered");
});

Deno.test("detects customs and return descriptions", () => {
  assertEquals(describeTrack17Status("InTransit", "", "Held for customs inspection").normalized, "customs_exception");
  assertEquals(describeTrack17Status("InTransit", "", "Customs clearance processing").normalized, "customs_clearance");
  assertEquals(describeTrack17Status("Exception", "ReturnToSender").normalized, "returned");
});

Deno.test("does not regress ordinary status rank", () => {
  assertEquals(statusCanAdvance(80, describeTrack17Status("InTransit")), false);
  assertEquals(statusCanAdvance(80, describeTrack17Status("Delivered")), true);
  assertEquals(statusCanAdvance(80, describeTrack17Status("DeliveryFailure")), true);
});
