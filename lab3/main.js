var audioCtx;
const playButton = document.querySelector('button');

function getBrownNoise() {
    var bufferSize = 10 * audioCtx.sampleRate,
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate),
    output = noiseBuffer.getChannelData(0);

    var lastOut = 0;
    for (var i = 0; i < bufferSize; i++) {
        var brown = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * brown)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
    }

    var brownNoise = audioCtx.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true; 
    brownNoise.start(0);
    return brownNoise;
}

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)

    // global gain
    var globalGain = audioCtx.createGain();
    globalGain.gain.value = .14;
    globalGain.connect(audioCtx.destination)

    // RHPF
    var rhpf = audioCtx.createBiquadFilter();
    rhpf.type = "highpass"
    rhpf.Q.value = 33;
    rhpf.connect(globalGain)

    // LPF14 + 500
    var lpfGainAdd= audioCtx.createGain();
    lpfGainAdd.gain.value = 1;
    lpfGainAdd.connect(rhpf.frequency);

    // LPF14 * 400
    var lpfGainMult = audioCtx.createGain();
    lpfGainMult.gain.value = 1000;
    lpfGainMult.connect(lpfGainAdd);

    // 500
    var constant = audioCtx.createConstantSource()
    constant.start()
    constant.offset.value = 140;
    constant.connect(lpfGainAdd)

    // LPF400
    var lpf1 = audioCtx.createBiquadFilter()
    lpf1.type = "lowpass"
    lpf1.frequency.value = 400;

    // LPF14
    var lpf2 = audioCtx.createBiquadFilter()
    lpf2.type = "lowpass"
    lpf2.frequency.value = 14;


    var brownNoise1 = getBrownNoise();
    var brownNoise2 = getBrownNoise();

    brownNoise1.connect(lpf1);
    brownNoise2.connect(lpf2);
    lpf1.connect(rhpf);
    lpf2.connect(lpfGainMult);

    console.log(rhpf.frequency.value)
}

playButton.addEventListener('click', function () {
    

    if (!audioCtx) {
        initAudio();
        return;
    }
    else if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    else if (audioCtx.state === 'running') {
        audioCtx.suspend();
    }

}, false);




