import { loadFont } from "@remotion/fonts";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Noto Sans/Serif KR, subset to ASCII + the 2,350 common Hangul syllables.
const serif = "Noto Serif KR";
const sans = "Noto Sans KR";
const FONTS = [
  { family: sans, weight: "400", file: "sans-400" },
  { family: sans, weight: "700", file: "sans-700" },
  { family: serif, weight: "500", file: "serif-500" },
  { family: serif, weight: "700", file: "serif-700" },
];
FONTS.forEach(({ family, weight, file }) =>
  loadFont({ family, weight, url: staticFile(`fonts/${file}.woff2`) }),
);

const BG = "#F5F0E8";
const INK = "#1F1E1D";
const CORAL = "#D97757";
const MUTED = "#6B6862";

const FPS = 30;
const SCENES = [
  { id: "intro", duration: 90 },
  { id: "abilities", duration: 105 },
  { id: "chat", duration: 105 },
  { id: "outro", duration: 75 },
];
const TOTAL = SCENES.reduce((s, x) => s + x.duration, 0);

export const MyComposition = () => {
  return (
    <Composition
      id="ClaudeIntro"
      component={ClaudeIntro}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};

/** Fades a scene in and out so cuts feel soft. */
const SceneFade: React.FC<{ duration: number; children: React.ReactNode }> = ({
  duration,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 10, duration - 10, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const ClaudeIntro: React.FC = () => {
  let from = 0;
  const scenes = [Intro, Abilities, Chat, Outro];
  return (
    <AbsoluteFill
      style={{ backgroundColor: BG, fontFamily: sans, wordBreak: "keep-all" }}
    >
      {SCENES.map((s, i) => {
        const Scene = scenes[i];
        const start = from;
        from += s.duration;
        return (
          <Sequence key={s.id} from={start} durationInFrames={s.duration} name={s.id}>
            <SceneFade duration={s.duration}>
              <Scene />
            </SceneFade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** Claude-style starburst: tapered rays that grow out from the center. */
const Spark: React.FC<{ size: number; delay?: number; spin?: boolean }> = ({
  size,
  delay = 0,
  spin = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rays = 12;
  const rotation = spin ? interpolate(frame, [0, 300], [0, 60]) : 0;
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200">
      <g transform={`rotate(${rotation})`}>
        {Array.from({ length: rays }).map((_, i) => {
          const grow = spring({
            frame: frame - delay - i * 2,
            fps,
            config: { damping: 12, stiffness: 120 },
          });
          const len = (i % 2 === 0 ? 92 : 74) * grow;
          return (
            <path
              key={i}
              d={`M -7 0 L 0 ${-len} L 7 0 Z`}
              fill={CORAL}
              transform={`rotate(${(360 / rays) * i})`}
            />
          );
        })}
        <circle r={14} fill={CORAL} />
      </g>
    </svg>
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const textIn = spring({ frame: frame - 25, fps, config: { damping: 200 } });
  const subIn = spring({ frame: frame - 45, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        <Spark size={240} />
        <div
          style={{
            fontFamily: serif,
            fontWeight: 500,
            fontSize: 200,
            color: INK,
            letterSpacing: -4,
            opacity: textIn,
            transform: `translateX(${(1 - textIn) * -40}px)`,
          }}
        >
          Claude
        </div>
      </div>
      <div
        style={{
          marginTop: 40,
          fontSize: 64,
          color: MUTED,
          opacity: subIn,
          transform: `translateY(${(1 - subIn) * 30}px)`,
        }}
      >
        당신의 생각을 함께 키우는 AI
      </div>
    </AbsoluteFill>
  );
};

const ABILITIES = [
  { icon: "✍️", title: "글쓰기", body: "초안부터 다듬기까지" },
  { icon: "💻", title: "코딩", body: "코드를 읽고, 쓰고, 고치기" },
  { icon: "📊", title: "분석", body: "복잡한 자료를 명쾌하게" },
];

const Abilities: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", padding: 140 }}
    >
      <div
        style={{
          fontFamily: serif,
          fontWeight: 700,
          fontSize: 110,
          color: INK,
          opacity: head,
          transform: `translateY(${(1 - head) * 30}px)`,
          marginBottom: 80,
        }}
      >
        무엇이든 함께 <span style={{ color: CORAL }}>생각해요</span>
      </div>
      <div style={{ display: "flex", gap: 56 }}>
        {ABILITIES.map((a, i) => {
          const pop = spring({
            frame: frame - 18 - i * 10,
            fps,
            config: { damping: 14, stiffness: 140 },
          });
          return (
            <div
              key={a.title}
              style={{
                width: 460,
                padding: "56px 48px",
                borderRadius: 40,
                background: "#FFFFFF",
                boxShadow: "0 20px 60px rgba(31,30,29,0.08)",
                border: `3px solid ${i === 1 ? CORAL : "transparent"}`,
                opacity: Math.min(1, pop),
                transform: `translateY(${(1 - pop) * 80}px) scale(${0.85 + 0.15 * pop})`,
              }}
            >
              <div style={{ fontSize: 96 }}>{a.icon}</div>
              <div
                style={{ fontSize: 80, fontWeight: 700, color: INK, marginTop: 20 }}
              >
                {a.title}
              </div>
              <div style={{ fontSize: 44, color: MUTED, marginTop: 12 }}>
                {a.body}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const QUESTION = "이 코드 왜 안 돌아가?";
const ANSWER = "같이 살펴볼게요! 3번째 줄에서 변수 이름이 달라요.";

const Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const q = spring({ frame: frame - 5, fps, config: { damping: 16 } });
  const a = spring({ frame: frame - 30, fps, config: { damping: 16 } });
  const chars = Math.floor(
    interpolate(frame, [38, 85], [0, ANSWER.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const caret = frame < 92 && Math.floor(frame / 8) % 2 === 0;
  const bubble: React.CSSProperties = {
    fontSize: 60,
    padding: "36px 52px",
    borderRadius: 48,
    maxWidth: 1300,
    lineHeight: 1.4,
  };
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 220px",
        gap: 56,
      }}
    >
      <div
        style={{
          ...bubble,
          alignSelf: "flex-end",
          background: "#E8E1D5",
          color: INK,
          opacity: q,
          transform: `translateY(${(1 - q) * 40}px)`,
        }}
      >
        {QUESTION}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 32,
          opacity: a,
          transform: `translateY(${(1 - a) * 40}px)`,
        }}
      >
        <div style={{ flexShrink: 0, marginTop: 12 }}>
          <Spark size={110} delay={28} />
        </div>
        <div
          style={{
            ...bubble,
            background: "#FFFFFF",
            color: INK,
            boxShadow: "0 20px 60px rgba(31,30,29,0.08)",
            minHeight: 84,
          }}
        >
          {ANSWER.slice(0, chars)}
          <span style={{ color: CORAL, opacity: caret ? 1 : 0 }}>▍</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const tag = spring({ frame: frame - 15, fps, config: { damping: 200 } });
  const line = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${0.9 + 0.1 * s})`, opacity: s }}>
        <Spark size={200} spin={false} />
      </div>
      <div
        style={{
          fontFamily: serif,
          fontSize: 120,
          fontWeight: 500,
          color: INK,
          marginTop: 30,
          opacity: s,
        }}
      >
        Claude와 시작해보세요
      </div>
      <div
        style={{
          width: 520 * line,
          height: 6,
          borderRadius: 3,
          background: CORAL,
          marginTop: 36,
        }}
      />
      <div
        style={{
          fontSize: 48,
          color: MUTED,
          marginTop: 36,
          letterSpacing: 6,
          opacity: tag,
        }}
      >
        by Anthropic
      </div>
    </AbsoluteFill>
  );
};
