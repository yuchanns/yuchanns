ENTRY(_start)

SECTIONS {
    . = 0x7c00;
    .bootloader :
    {
        *(.mbr)
        _bootloader_start_addr = .;
        *(.bootloader)
        . = ALIGN(512);
        _bootloader_end_addr = .;
    }

    .kernel :
    {
        _kernel_start_addr = .;
        *(.kernel)
        . = ALIGN(512);
        _kernel_end_addr = .;
    }
}
