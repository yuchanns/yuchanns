section .mbr
global _start
extern _bootloader_start_addr
extern _bootloader_end_addr
extern _bootloader

[bits 16]
_start:
    mov ax, cs
    mov ss, ax
    mov sp, 0x7c00

load_bootloader:
    lea eax, [_bootloader_start_addr]
    mov ebx, eax
    shr ebx, 4
    mov [dap_buffer_seg], bx

    shl ebx, 4
    sub eax, ebx
    mov [dap_buffer_addr], ax

    lea eax, [_bootloader_start_addr]
    lea ebx, [_bootloader_end_addr]
    sub ebx, eax
    shr ebx, 9
    mov [dap_blocks], ebx

    lea ebx, [_start]
    sub eax, ebx
    shr eax, 9
    mov [dap_start_lba], eax
.int13_42h:
    lea si, [dap]
    mov ah, 0x42
    int 0x13

    mov word [dap_buffer_seg], 0

load_gdt:
    lgdt [cs:gdtinfo]
enable_a20:
    in al, 0x92
    or al, 0000_0010B
    out 0x92, al
enter_protected_mode:
    cli

    mov eax, cr0
    or eax, 1
    mov cr0, eax
    jmp dword 0x0010:protected_mode

    [bits 32]
 protected_mode:
    mov eax, 0x0008
    mov ds, eax
    mov es, eax
    mov fs, eax
    mov gs, eax

    mov eax, 0x0018
    mov ss, eax
    xor esp, esp

    jmp dword 0x0010:_bootloader

loop_hlt:
    hlt
    jmp loop_hlt

gdtinfo:
    dw gdt_end - gdt_start - 1
    dd gdt_start
gdt_start:
    dq 0
data_desc:
    dd 0x0000ffff
    dd 0x00cf9200
code_desc:
    dd 0x0000ffff
    dd 0x00cf9a00
stack_desc:
    dd 0x7c00fffe
    dd 0x00cf9600
gdt_end:

dap:
    db 0x10
    db 0
dap_blocks:
    dw 0
dap_buffer_addr:
    dw 0
dap_buffer_seg:
    dw 0
dap_start_lba:
    dq 0

times 510-($-$$) db 0
dw 0xaa55

