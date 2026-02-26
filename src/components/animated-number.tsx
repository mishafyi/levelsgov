"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring, MotionValue } from "motion/react";

function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1500 }) as MotionValue<number>;
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) motionValue.set(value);
  }, [isInView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest: number) => {
      if (!ref.current) return;
      const rounded = Math.round(latest);
      const formatted = new Intl.NumberFormat("en-US").format(Math.abs(rounded));
      const sign = value < 0 && rounded !== 0 ? "-" : value < 0 ? "" : "";
      ref.current.textContent = `${prefix}${sign}${formatted}${suffix}`;
    });
    return unsubscribe;
  }, [spring, prefix, suffix, value]);

  // SSR fallback: render final value
  const formatted = new Intl.NumberFormat("en-US").format(Math.abs(value));
  const sign = value < 0 ? "-" : "";

  return (
    <span ref={ref} className={className}>
      {prefix}{sign}{formatted}{suffix}
    </span>
  );
}

export { AnimatedNumber };
