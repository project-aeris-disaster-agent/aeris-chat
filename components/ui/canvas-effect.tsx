"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";

import { Canvas, useFrame, useThree } from "@react-three/fiber";

import * as THREE from "three";

import { cn } from "@/lib/utils";

export const CanvasRevealEffect = ({

  animationSpeed = 0.4,

  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],

  colors = [[0, 255, 255]],

  containerClassName,

  dotSize,

  mousePosition,

  hue = 0,

  saturation = 1.0,

  contrast = 1.0,

  glow = 0.0,

  vibrance = 0.0,

}: {

  animationSpeed?: number;

  opacities?: number[];

  colors?: number[][];

  containerClassName?: string;

  dotSize?: number;

  showGradient?: boolean;

  mousePosition?: { x: number; y: number } | null;

  hue?: number;

  saturation?: number;

  contrast?: number;

  glow?: number;

  vibrance?: number;

}) => {

  const containerRef = useRef<HTMLDivElement>(null);

  return (

    <div 
      ref={containerRef}
      className={cn("relative h-full w-full bg-background", containerClassName)}
    >

      <div className="h-full w-full">

          <DotMatrix

          colors={colors ?? [[0, 255, 255]]}

          dotSize={dotSize ?? 3}

          opacities={

            opacities ?? [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]

          }

          mousePosition={mousePosition}

          animationSpeed={animationSpeed}

          hue={hue}

          saturation={saturation}

          contrast={contrast}

          glow={glow}

          vibrance={vibrance}

          shader={`

              float animation_speed_factor = ${animationSpeed.toFixed(1)};

              float intro_offset = distance(u_resolution / 2.0 / u_total_size, st2) * 0.01 + (random(st2) * 0.15);

              opacity *= step(intro_offset, u_time * animation_speed_factor);

              opacity *= clamp((1.0 - step(intro_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);

            `}

          center={["x", "y"]}

        />

      </div>

    </div>

  );

};

interface DotMatrixProps {

  colors?: number[][];

  opacities?: number[];

  totalSize?: number;

  dotSize?: number;

  shader?: string;

  center?: ("x" | "y")[];

  mousePosition?: { x: number; y: number } | null;

  animationSpeed?: number;

  hue?: number;

  saturation?: number;

  contrast?: number;

  glow?: number;

  vibrance?: number;

}

const DotMatrix: React.FC<DotMatrixProps> = ({

  colors = [[0, 0, 0]],

  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],

  totalSize = 4,

  dotSize = 2,

  shader = "",

  center = ["x", "y"],

  mousePosition,

  animationSpeed = 1.0,

  hue = 0,

  saturation = 1.0,

  contrast = 1.0,

  glow = 0.0,

  vibrance = 0.0,

}) => {

  const uniforms = React.useMemo(() => {

    let colorsArray = [

      colors[0],

      colors[0],

      colors[0],

      colors[0],

      colors[0],

      colors[0],

    ];

    if (colors.length === 2) {

      colorsArray = [

        colors[0],

        colors[0],

        colors[0],

        colors[1],

        colors[1],

        colors[1],

      ];

    } else if (colors.length === 3) {

      colorsArray = [

        colors[0],

        colors[0],

        colors[1],

        colors[1],

        colors[2],

        colors[2],

      ];

    }

    return {

      u_colors: {

        value: colorsArray.map((color) => [

          color[0] / 255,

          color[1] / 255,

          color[2] / 255,

        ]),

        type: "uniform3fv",

      },

      u_opacities: {

        value: opacities,

        type: "uniform1fv",

      },

      u_total_size: {

        value: totalSize,

        type: "uniform1f",

      },

      u_dot_size: {

        value: dotSize,

        type: "uniform1f",

      },

      u_mouse: {

        value: [0.5, 0.5],

        type: "uniform2f",

      },

      u_animation_speed: {

        value: animationSpeed,

        type: "uniform1f",

      },

      u_hue: {

        value: hue,

        type: "uniform1f",

      },

      u_saturation: {

        value: saturation,

        type: "uniform1f",

      },

      u_contrast: {

        value: contrast,

        type: "uniform1f",

      },

      u_glow: {

        value: glow,

        type: "uniform1f",

      },

      u_vibrance: {

        value: vibrance,

        type: "uniform1f",

      },

    };

  }, [colors, opacities, totalSize, dotSize, animationSpeed, hue, saturation, contrast, glow, vibrance]);

  return (

    <Shader

      source={`

        precision mediump float;

        in vec2 fragCoord;

        uniform float u_time;

        uniform float u_opacities[10];

        uniform vec3 u_colors[6];

        uniform float u_total_size;

        uniform float u_dot_size;

        uniform vec2 u_resolution;

        uniform vec2 u_mouse;

        uniform float u_animation_speed;

        uniform float u_hue;

        uniform float u_saturation;

        uniform float u_contrast;

        uniform float u_glow;

        uniform float u_vibrance;

        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;

        float random(vec2 xy) {

            return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);

        }

        float map(float value, float min1, float max1, float min2, float max2) {

            return min2 + (value - min1) * (max2 - min2) / (max1 - min1);

        }

        // Convert RGB to HSV
        vec3 rgb2hsv(vec3 c) {
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        // Convert HSV to RGB
        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {

            vec2 st = fragCoord.xy;

            ${

              center.includes("x")

                ? "st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));"

                : ""

            }

            ${

              center.includes("y")

                ? "st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));"

                : ""

            }

      float opacity = step(0.0, st.x);

      opacity *= step(0.0, st.y);

      vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

      float frequency = 3.0;

      float show_offset = random(st2);

      // Continuous, seamless animation using modulo for infinite looping
      float anim_time = mod(u_time * u_animation_speed * 0.3, frequency);
      float phase = (anim_time / frequency) + show_offset;
      
      // Use continuous phase instead of floor() to avoid stuttering
      float continuous_phase = phase * 10.0;
      float phase_floor = floor(continuous_phase);
      float phase_fract = fract(continuous_phase);
      
      // Smooth interpolation between opacity values
      float rand1 = random(st2 * (phase_floor + 1.0));
      float rand2 = random(st2 * (phase_floor + 2.0));
      float opacity1 = u_opacities[int(rand1 * 10.0)];
      float opacity2 = u_opacities[int(rand2 * 10.0)];
      opacity *= mix(opacity1, opacity2, phase_fract);
      
      // Add subtle pulsing for more explicit animation
      float pulse = sin(u_time * u_animation_speed * 1.5 + show_offset * 6.28318) * 0.15 + 0.85;
      opacity *= pulse;

      opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));

      opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

      // Mouse interaction effect - ripple/wave effect

      vec2 mousePos = u_mouse * u_resolution;

      float dist = distance(fragCoord, mousePos);

      float mouseEffect = 0.0;

      if (dist < 300.0) {

        float normalizedDist = dist / 300.0;

        mouseEffect = sin(normalizedDist * 3.14159 - u_time * 2.0) * 0.5 + 0.5;

        mouseEffect = pow(1.0 - normalizedDist, 2.0) * mouseEffect * 0.4;

        opacity += mouseEffect;

        opacity = min(opacity, 1.0);

      }

      // Smooth color transitions with time-based animation
      float color_phase = mod(u_time * u_animation_speed * 0.2 + show_offset * 2.0, 6.0);
      int color_idx1 = int(color_phase);
      int color_idx2 = int(mod(color_phase + 1.0, 6.0));
      float color_blend = fract(color_phase);
      
      vec3 color1 = u_colors[color_idx1];
      vec3 color2 = u_colors[color_idx2];
      vec3 color = mix(color1, color2, color_blend);
      
      // Apply hue shift
      if (abs(u_hue) > 0.01) {
        vec3 hsv = rgb2hsv(color);
        hsv.x = mod(hsv.x + u_hue / 360.0, 1.0);
        color = hsv2rgb(hsv);
      }
      
      // Apply saturation
      if (abs(u_saturation - 1.0) > 0.01) {
        vec3 gray = vec3(dot(color, vec3(0.299, 0.587, 0.114)));
        color = mix(gray, color, u_saturation);
      }
      
      // Apply contrast
      if (abs(u_contrast - 1.0) > 0.01) {
        color = (color - 0.5) * u_contrast + 0.5;
        color = clamp(color, 0.0, 1.0);
      }
      
      // Apply glow effect (additive brightness)
      if (u_glow > 0.01) {
        float glow_intensity = opacity * u_glow;
        color += vec3(glow_intensity);
        color = min(color, vec3(1.0));
      }

      // Apply vibrance (boost saturation more on muted colors)
      if (u_vibrance > 0.01) {
        vec3 hsv = rgb2hsv(color);
        float boost = (1.0 - hsv.y) * u_vibrance;
        hsv.y = clamp(hsv.y + boost, 0.0, 1.0);
        color = hsv2rgb(hsv);
      }

      ${shader}

      fragColor = vec4(color, opacity);

      fragColor.rgb *= fragColor.a;

        }`}

      uniforms={uniforms}

      mousePosition={mousePosition}

      maxFps={60}

    />

  );

};

type Uniforms = Record<

  string,

  {

    value: number[] | number[][] | number;

    type: string;

  }

>;

const ShaderMaterial = ({

  source,

  uniforms,

  maxFps = 60,

  mousePosition,

}: {

  source: string;

  hovered?: boolean;

  maxFps?: number;

  uniforms: Uniforms;

  mousePosition?: { x: number; y: number } | null;

}) => {

  const { size } = useThree();

  const ref = useRef<THREE.Mesh>();

  let lastFrameTime = 0;

  useFrame(({ clock }) => {

    if (!ref.current) return;

    const timestamp = clock.getElapsedTime();

    if (timestamp - lastFrameTime < 1 / maxFps) {

      return;

    }

    lastFrameTime = timestamp;

    const material: any = ref.current.material;

    const timeLocation = material.uniforms.u_time;

    timeLocation.value = timestamp;

    // Update mouse position uniform

    if (mousePosition && material.uniforms.u_mouse) {

      // Normalize mouse position to 0-1 range

      const normalizedX = mousePosition.x / size.width;

      const normalizedY = 1.0 - (mousePosition.y / size.height); // Flip Y coordinate

      material.uniforms.u_mouse.value.set(normalizedX, normalizedY);

    }

  });

  const getUniforms = () => {

    const preparedUniforms: any = {};

    for (const uniformName in uniforms) {

      const uniform: any = uniforms[uniformName];

      switch (uniform.type) {

        case "uniform1f":

          preparedUniforms[uniformName] = { value: uniform.value, type: "1f" };

          break;

        case "uniform3f":

          preparedUniforms[uniformName] = {

            value: new THREE.Vector3().fromArray(uniform.value),

            type: "3f",

          };

          break;

        case "uniform1fv":

          preparedUniforms[uniformName] = { value: uniform.value, type: "1fv" };

          break;

        case "uniform3fv":

          preparedUniforms[uniformName] = {

            value: uniform.value.map((v: number[]) =>

              new THREE.Vector3().fromArray(v),

            ),

            type: "3fv",

          };

          break;

        case "uniform2f":

          preparedUniforms[uniformName] = {

            value: new THREE.Vector2().fromArray(uniform.value),

            type: "2f",

          };

          break;

        default:

          console.error(`Invalid uniform type for '${uniformName}'.`);

          break;

      }

    }

    preparedUniforms.u_time = { value: 0, type: "1f" };

    preparedUniforms.u_resolution = {

      value: new THREE.Vector2(size.width * 2, size.height * 2),

    };

    preparedUniforms.u_mouse = {

      value: new THREE.Vector2(0.5, 0.5),

    };

    return preparedUniforms;

  };

  const material = useMemo(() => {

    const materialObject = new THREE.ShaderMaterial({

      vertexShader: `

      precision mediump float;

      in vec2 coordinates;

      uniform vec2 u_resolution;

      out vec2 fragCoord;

      void main(){

        float x = position.x;

        float y = position.y;

        gl_Position = vec4(x, y, 0.0, 1.0);

        fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;

        fragCoord.y = u_resolution.y - fragCoord.y;

      }

      `,

      fragmentShader: source,

      uniforms: getUniforms(),

      glslVersion: THREE.GLSL3,

      blending: THREE.CustomBlending,

      blendSrc: THREE.SrcAlphaFactor,

      blendDst: THREE.OneFactor,

    });

    return materialObject;

  }, [size.width, size.height, source]);

  return (

    <mesh ref={ref as any}>

      <planeGeometry args={[2, 2]} />

      <primitive object={material} attach="material" />

    </mesh>

  );

};

const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60, mousePosition }) => {

  return (

    <Canvas className="absolute inset-0  h-full w-full">

      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} mousePosition={mousePosition} />

    </Canvas>

  );

};

interface ShaderProps {

  source: string;

  uniforms: Record<

    string,

    {

      value: number[] | number[][] | number;

      type: string;

    }

  >;

  maxFps?: number;

  mousePosition?: { x: number; y: number } | null;

}
