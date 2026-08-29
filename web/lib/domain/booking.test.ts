import { describe, expect, it } from "vitest";
import { busyWindow, freePlanLimitReached, overlaps } from "./booking";
describe("booking domain",()=>{it("detects overlaps but allows adjacent ranges",()=>{expect(overlaps(10,20,19,30)).toBe(true);expect(overlaps(10,20,20,30)).toBe(false);});it("applies service buffers",()=>{expect(busyWindow(1_000_000,30,5,10)).toEqual({start:700_000,end:3_400_000});});it("enforces 10 bookings on Free",()=>{expect(freePlanLimitReached(9)).toBe(false);expect(freePlanLimitReached(10)).toBe(true);});});
