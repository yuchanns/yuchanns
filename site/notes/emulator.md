---
title: Emulator Tips
---

* hid
    
    **Human interface device** or **HID** is a type of computer device usually used by
    humans that takes input from humans and gives output to humans.

    The term "HID" most commonly refers to the USB-HID specification.

    [WIKIPEDIA](https://en.wikipedia.org/wiki/Human_interface_device)

* hle/lle
    
    **High-level emulation (HLE) and low-level emulation (LLE)** refer to methods
    used when emulating components or entire systems.

    They're used to differentiate approaches to system implementations by how
    each emulator handles a given component; a high-level emulator abstract the
    component with the goal of improving performance on the host, sacrificing
    the thorough measures needed to guarantee the correct behavior. The
    simplicity of most consoles allow low-level emulation to be feasible.

    [EMUGEN](https://emulation.gametechwiki.com/index.php/High/Low_level_emulation)

* workflows of yuzu

    `yuzu` and `yuzu_cmd` are two threads on program start. `yuzu` dedicates for ui 
    while `yuzu_cmd` loads files and does emulation. `yuzu_cmd` is the Application
    entry point.

    #### yuzu_cmd startup
    * Initiates logger
    * Parses arguments
    * Applys settings
    * Determins renderer backend between OpenGL and Vulkan
    * Set File system
    * Load ROM and create GPU
        * function signature in `core.cpp`: `SystemResultStatus Load(System& system,
          Frontend::EmuWindow& emu_window, const std::string& filepath,
          u64 program_id, std:size_t program_index)`)
    * Start GPU
    * Register exit callback
    * Run
    * (Optional) Enable Debugger
    * Wait for emulator window event
    * (Stop) Detach debugger
    * (Stop) Pause
    * (Stop) Shutdown
    * (Stop) Wait all detached tasks
