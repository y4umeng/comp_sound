var audioCtx;
var globalAnalyser;


document.addEventListener("DOMContentLoaded", function(event) {

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const globalGain = audioCtx.createGain(); //this will control the volume of all notes
    globalGain.gain.setValueAtTime(0.9, audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);
    globalAnalyser = audioCtx.createAnalyser();

    const lfo = getLFO();
    const lfoGain = audioCtx.createGain();
    lfoGain.gain = 100;
    lfo.connect(lfoGain).connect(globalGain.gain)

    
    const compressor = audioCtx.createDynamicsCompressor();
    const softClipper = audioCtx.createWaveShaper();

    globalGain.connect(softClipper);
    softClipper.connect(compressor);
    compressor.connect(globalAnalyser);

    // modified from https://github.com/nick-thompson/neuro/blob/master/lib/effects/WaveShaper.js
    var n = 65536;

    var softCurve = new Float32Array(n);
    var amt = .2;
    var k = 2 * amt / (1 - amt);

    for (var i = 0; i < n; i++) {
        var x = (i - (n / 2)) / (n / 2);
        softCurve[i] = (1 + k) * x / (1 + k * Math.abs(x))
    }
    softClipper.curve = softCurve;
    softClipper.overjhgfsample = '2x';

    const keyboardFrequencyMap = {
        '90': 261.625565300598634,  //Z - C
        '83': 277.182630976872096, //S - C#
        '88': 293.664767917407560,  //X - D
        '68': 311.126983722080910, //D - D#
        '67': 329.627556912869929,  //C - E
        '86': 349.228231433003884,  //V - F
        '71': 369.994422711634398, //G - F#
        '66': 391.995435981749294,  //B - G
        '72': 415.304697579945138, //H - G#
        '78': 440.000000000000000,  //N - A
        '74': 466.163761518089916, //J - A#
        '77': 493.883301256124111,  //M - B
        '81': 523.251130601197269,  //Q - C
        '50': 554.365261953744192, //2 - C#
        '87': 587.329535834815120,  //W - D
        '51': 622.253967444161821, //3 - D#xz
        '69': 659.255113825739859,  //E - E
        '82': 698.456462866007768,  //R - F
        '53': 739.988845423268797, //5 - F#
        '84': 783.990871963498588,  //T - G
        '54': 830.609395159890277, //6 - G#
        '89': 880.000000000000000,  //Y - A
        '55': 932.327523036179832, //7 - A#
        '85': 987.766602512248223,  //U - B
    }  

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    activeOscillators = {};
    activeGains = {};
    activeModulators = {};


    document.getElementById("attackSlider").oninput = function () {
        document.getElementById("attackLabel").innerHTML = this.value;
    }
    document.getElementById("decaySlider").oninput = function () {
        document.getElementById("decayLabel").innerHTML = this.value;
    }
    document.getElementById("sustainSlider").oninput = function () {
        document.getElementById("sustainLabel").innerHTML = this.value;
    }
    document.getElementById("modSlider").oninput = function () {
        document.getElementById("modLabel").innerHTML = this.value;
    }

    document.getElementById("lfo").oninput = function () {
        lfo.type = document.getElementById("lfo");
    }

    document.getElementById("lfoSlider").oninput = function () {
        lfo.frequency.setValueAtTime(Number(document.getElementById("lfoSlider").value), audioCtx.currentTime);
        // console.log(lfo.frequency.value)
        document.getElementById("lfoLabel").innerHTML = this.value;
    } 

    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
            switch(document.querySelector('#synth').value) {
                case "none":
                    playNote(key);
                    break;
                case "additive":
                    playAdditive(key);
                    break;
                case "fm":
                    console.log("hai")
                    playFM(key);
                    break;
                case "am":
                    playAM(key);
                    break;
                default:
                    break;
            }
        }
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && activeOscillators[key]) {
            const releaseDuration = Number(document.getElementById("releaseSlider").value);
            activeGains[key].gain.cancelAndHoldAtTime(audioCtx.currentTime);
            activeGains[key].gain.linearRampToValueAtTime(0, audioCtx.currentTime + releaseDuration);

            delete activeOscillators[key];
            delete activeGains[key];
            delete activeModulators[key];
        }
    } 

    function playAdditive(key) {
        const num_oscs = 5;
        var oscs = new Array(num_oscs);
        const gainNode = getGainNode(num_oscs); 
        for(var i = 0; i < num_oscs; i++) {
            oscs[i] = getOSC(keyboardFrequencyMap[key] + i * 40);
            oscs[i].connect(gainNode);
        }

        draw();
        activeOscillators[key] = oscs;
        activeGains[key] = gainNode;
    }

    function playFM(key) {
        var carrier = getOSC(keyboardFrequencyMap[key]);
        var modulatorFreq = getOSC(Number(document.getElementById("modSlider").value));

        modulationIndex = audioCtx.createGain();
        modulationIndex.gain.value = 100;

        modulatorFreq.connect(modulationIndex);
        modulationIndex.connect(carrier.frequency)
        
        var gainNode = getGainNode(1);
        carrier.connect(gainNode);

        draw();
        activeOscillators[key] = [carrier, modulatorFreq];
        activeGains[key] = gainNode;
        activeModulators[key] = modulationIndex;

    }

    function playAM(key) {
        var carrier = getOSC(key);
        var modulatorFreq = getOSC(Number(document.getElementById("modSlider").value));
    
        const modulated = audioCtx.createGain();
        const depth = audioCtx.createGain();
        const gainNode = getGainNode(1);
        depth.gain.value = 0.5 //scale modulator output to [-0.5, 0.5]
        modulated.gain.value = 1.0 - depth.gain.value; //a fixed value of 0.5
    
        modulatorFreq.connect(depth).connect(modulated.gain); //.connect is additive, so with [-0.5,0.5] and 0.5, the modulated signal now has output gain at [0,1]
        carrier.connect(modulated)
        modulated.connect(gainNode);
        
        draw();
        activeOscillators[key] = [carrier, modulatorFreq];
        activeGains[key] = gainNode;
        activeModulators[key] = [modulated, depth];
    }

    function getGainNode(num_oscs) {
        const gainNode = audioCtx.createGain(); 

        const currentTime = audioCtx.currentTime;
        // const volume = Math.min(Math.max(0.8 - Math.max(Object.keys(activeOscillators).length * 0.3 * num_oscs), 0), 0.25);
        const volume = .2 / (num_oscs) ;
        const attackDuration = Number(document.getElementById("attackSlider").value);
        const sustainLevel = Number(document.getElementById("sustainSlider").value) * volume;
        const decayDuration = Number(document.getElementById("decaySlider").value);

        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, currentTime + attackDuration);
        gainNode.gain.linearRampToValueAtTime(sustainLevel * volume, currentTime + attackDuration + decayDuration);
        gainNode.connect(globalGain);
        return gainNode;
    }

    function getOSC(freq) {
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        const wave = document.querySelector('#waveform').value;
        if (wave == 'custom') {
            const obj = JSON.parse(document.querySelector('#arrays').value);
            var waveTable = audioCtx.createPeriodicWave(obj.real, obj.imag);
            osc.setPeriodicWave(waveTable);
        }
        else {
            osc.type = wave;
        }
        osc.start();
        return osc;
    }

    function getLFO() {
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(30, audioCtx.currentTime);
        const wave = document.querySelector('#lfo').value;
        osc.type = wave;
        osc.start();
        return osc; 
    }

    function playNote(key) {
        const osc = getOSC(keyboardFrequencyMap[key]);
        const gainNode = getGainNode(1);
        osc.connect(gainNode);
        draw();
        activeOscillators[key] = [osc];
        activeGains[key] = gainNode;
    }

    function draw() {
        globalAnalyser.fftSize = 2048;
        bufferLength = globalAnalyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        globalAnalyser.getByteTimeDomainData(dataArray);

        var canvas = document.querySelector("#globalVisualizer");
        var canvasCtx = canvas.getContext("2d");
    
        requestAnimationFrame(draw);
    
        globalAnalyser.getByteTimeDomainData(dataArray);
    
        canvasCtx.fillStyle = "white";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "rgb(0, 0, 0)";
    
        canvasCtx.beginPath();
    
        var sliceWidth = canvas.width * 1.0 / bufferLength;
        var x = 0;
    
        for (var i = 0; i < bufferLength; i++) {
            var v = dataArray[i] / 128.0;
            var y = v * canvas.height / 2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
    
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }


});