# KORG nanoKONTROL 2 controller script
This scripts controls a *KORG nanoKONTROL 2* control surface in Tracktion's Waveform DAW.

## Installation

**NOTE**: Paths are given for a Linux system. For Windows or MacOS, the structure is similar.

1. Set the KORG nanoKONTROL 2 in CUBASE DAW mode. This must be done ***only once***. The device will remember its current operating mode between switch offs:
	* Unplug the USB KORG nanoKONTROL 2 cable.
	* Press and hold [SET] and [REW] buttons.
	* Plug the USB cable. The [REW] button breifly flashes.
2. Download the latest version of the controller file from GitHub.
3. Place the controller file under `${HOME}/.config/Tracktion/Waveform/Controller/User/` directory.
4. Start Waveform.
5. Under `Settings > MIDI Devices`, make sure that the KORG nanoKONTROL 2 is enabled as a MIDI device.
6. Under `Settings > Control Surfaces`:
	* make sure you see the `Korg nanoKONTROL 2` controller listed.
	* Select it and assign the input MIDI and output MIDI ports to the nanoKONTROL 2 MIDI ports.

## Development notes.

The controller is structured as a series of subcontrollers, namely:
1. The Channel Strip controller, handling the [SOLO], [MUTE] and [REC] buttons, the [PAN] Knob and [VOL] slider.
2. The Track bank and Loop controller, handling the two [<<] [>>] track buttons and the [CYCLE] button.
3. The Markers controller, handling the [SET] and two [<<] [>>] marker buttons
4. The Transport controller, handling [PLAY], [STOP], [REC], [FF] and [REW] buttons.

The controller logs messages to a file when debugging. The global constant `DEBUG` which controls the amount of logging.
The file is `${HOME}/.config/Tracktion/Waveform/Temporary/WaveformKorgnanoKONTROL2.txt`