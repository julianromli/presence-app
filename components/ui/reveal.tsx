"use client";

import type { HTMLMotionProps } from "motion/react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type RevealBaseProps = {
  delay?: number;
  distance?: number;
  once?: boolean;
};

type RevealProps = HTMLMotionProps<"div"> & RevealBaseProps;
type RevealItemProps = HTMLMotionProps<"li"> & RevealBaseProps;

const revealEase = [0.16, 1, 0.3, 1] as const;

function getRevealMotion(
  prefersReducedMotion: boolean | null,
  delay: number,
  distance: number,
  once: boolean,
) {
  if (prefersReducedMotion) {
    return {
      initial: false as const,
      transition: undefined,
      viewport: { once, amount: 0.2 },
      whileInView: undefined,
    };
  }

  return {
    initial: { opacity: 0, y: distance, scale: 0.985 },
    transition: { delay, duration: 0.72, ease: revealEase },
    viewport: { once, amount: 0.2 },
    whileInView: { opacity: 1, y: 0, scale: 1 },
  };
}

export function Reveal({
  children,
  className,
  delay = 0,
  distance = 28,
  once = true,
  ...props
}: RevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const revealMotion = getRevealMotion(
    prefersReducedMotion,
    delay,
    distance,
    once,
  );

  return (
    <motion.div className={cn(className)} {...revealMotion} {...props}>
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  delay = 0,
  distance = 24,
  once = true,
  ...props
}: RevealItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const revealMotion = getRevealMotion(
    prefersReducedMotion,
    delay,
    distance,
    once,
  );

  return (
    <motion.li className={cn(className)} {...revealMotion} {...props}>
      {children}
    </motion.li>
  );
}
