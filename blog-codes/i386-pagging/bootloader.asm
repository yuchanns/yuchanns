section .bootloader
global _bootloader

clean_screen:
    push ecx
    push eax
    push edi

    lea edi, [es:0xb8000]
    mov ecx, 4000
    shr ecx, 2
    xor eax, eax
    rep stosd

    pop edi
    pop eax
    pop ecx

    ret

_bootloader:
    call clean_screen
    mov byte [es:0xb8000+0x7c0], 'H'
    mov byte [es:0xb8000+0x7c1], 0x0b
    mov byte [es:0xb8000+0x7c2], 'E'
    mov byte [es:0xb8000+0x7c3], 0x0b
ghlt:
    hlt
