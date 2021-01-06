# Controller for Robot Challenge

Note that the server is a Heroku App and this controller runs on the computer connected to the arduino(s)
# Robot Controller 

## NOTES for setting up HC-05 Bluetooth Module:

Useful Links:

* [rwaldron github](https://github.com/rwaldron/johnny-five/wiki/Getting-Started-with-Johnny-Five-and-HC-05-Bluetooth-Serial-Port-Module)
* [pofay.github.io](https://pofay.github.io/2018/11/08/setup-wireless-tethering-for-johnny-five-in-arduino-using-hc05-BT.html)

Steps:

* First setup the HC-05 Wiring (see rwaldron link above) for the INITIAL configuration (NOTE this means the HC-05 RX goes to Pin 11, TX to Pin 10 - using voltage divider).
* Next download the sample code (rwaldron)
* Change the robotname in the code. Leave the baud rate as 38400
* Connect the enable (EN) pin on the HC-05 to the 3.3 V on the Arduino.
* Power up. Upload the sample code and run. You should get the correct output (see rwaldron).
* Power Down. Remove the enable pin and re-wire the TX and RX pins as required.
* Now upload the StandardFirmataPlus example (You may need to power off HC-05 to do this)
* NOW boot up robot by plugging into power (battery).
* Go to Bluetooth Devices to pair robot with laptop (using Windows 10)
* Pin for HC-05 by default is 0000 (used in pairing)
* Now check the Arduino IDE ports and you should see the actual port number to use with Johnny-Five (eg. COM10). (Seem to get 2 ports showing up and only one works. Try the lower one first.)

