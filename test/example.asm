; Assembly example (NASM x86-64) — Code Scavenge test file

section .data
    msg     db "Hello", 0
    fmt_int db "%d", 10, 0

section .bss
    buf     resb 64

section .text

global _start
global clamp
global lerp_fixed
global vec2_add
global vec2_dot

%macro PUSH_REGS 0
    push rbp
    push rbx
    push r12
%endmacro

%macro POP_REGS 0
    pop r12
    pop rbx
    pop rbp
%endmacro

; int clamp(int value, int min, int max)
; rdi=value, rsi=min, rdx=max
clamp:
    mov eax, edi
    cmp eax, esi
    jge .check_max
    mov eax, esi
.check_max:
    cmp eax, edx
    jle .done
    mov eax, edx
.done:
    ret

; int lerp_fixed(int a, int b, int t_256)
; Linear interpolation with t in [0..256]
lerp_fixed:
    PUSH_REGS
    sub edi, esi        ; a - b  (reuse: b - a)
    mov eax, edx
    imul eax, edi       ; t * (a - b)  — sign issue, illustrative
    sar eax, 8          ; / 256
    add eax, esi
    POP_REGS
    ret

; void vec2_add(float* out, float* a, float* b)
; rdi=out, rsi=a, rdx=b
vec2_add:
    movss xmm0, [rsi]
    movss xmm1, [rsi + 4]
    addss xmm0, [rdx]
    addss xmm1, [rdx + 4]
    movss [rdi],     xmm0
    movss [rdi + 4], xmm1
    ret

; float vec2_dot(float* a, float* b)
; rdi=a, rsi=b  — returns in xmm0
vec2_dot:
    movss xmm0, [rdi]
    movss xmm1, [rdi + 4]
    mulss xmm0, [rsi]
    mulss xmm1, [rsi + 4]
    addss xmm0, xmm1
    ret

_start:
    mov rdi, 10
    mov rsi, 0
    mov rdx, 5
    call clamp
    ; result in eax = 5

    mov rax, 60
    xor rdi, rdi
    syscall
