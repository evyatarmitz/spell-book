// HLSL example — Code Scavenge test file

float Clamp01(float v) {
    return saturate(v);
}

float Lerp(float a, float b, float t) {
    return lerp(a, b, t);
}

float3 LinearToGamma(float3 color) {
    return pow(max(color, 0.0001), 1.0 / 2.2);
}

float3 GammaToLinear(float3 color) {
    return pow(color, 2.2);
}

float SdCircle(float2 p, float r) {
    return length(p) - r;
}

// Constant buffers (HLSL-specific — like a GPU-side struct)
cbuffer PerFrame : register(b0) {
    float4x4 viewProj;
    float3   cameraPos;
    float    time;
};

cbuffer PerObject : register(b1) {
    float4x4 model;
    float4   tint;
};

struct VertexInput {
    float3 position : POSITION;
    float2 uv       : TEXCOORD0;
    float3 normal   : NORMAL;
};

struct PixelInput {
    float4 position : SV_POSITION;
    float2 uv       : TEXCOORD0;
    float3 normal   : TEXCOORD1;
};

PixelInput VSMain(VertexInput input) {
    PixelInput output;
    output.position = float4(input.position, 1.0);
    output.uv = input.uv;
    output.normal = input.normal;
    return output;
}

float4 PSMain(PixelInput input) : SV_TARGET {
    return float4(input.uv, 0.0, 1.0);
}
