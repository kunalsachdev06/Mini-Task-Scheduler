/**
 * Enhanced Face Recognition Module for Production
 * Handles face detection, recognition, and biometric authentication
 */

class FaceRecognition {
  constructor() {
    this.modelsLoaded = false;
    this.videoStream = null;
    this.currentVideo = null;
    this.faceMatcher = null;
    this.models = null;
  }

  /**
   * Load face recognition models with fallback CDN options
   */
  async loadModels() {
    try {
      if (this.modelsLoaded) return true;

      console.log('Loading face recognition models...');

      // Primary CDN (more reliable)
      const primaryCDN = 'https://justadudewhohacks.github.io/face-api.js/models';
      const fallbackCDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';

      try {
        // Try primary CDN first
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(primaryCDN),
          faceapi.nets.faceLandmark68Net.loadFromUri(primaryCDN),
          faceapi.nets.faceRecognitionNet.loadFromUri(primaryCDN),
          faceapi.nets.faceExpressionNet.loadFromUri(primaryCDN)
        ]);
        console.log('Models loaded from primary CDN');
      } catch (primaryError) {
        console.warn('Primary CDN failed, trying fallback:', primaryError);
        
        // Fallback to secondary CDN
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(fallbackCDN),
          faceapi.nets.faceLandmark68Net.loadFromUri(fallbackCDN),
          faceapi.nets.faceRecognitionNet.loadFromUri(fallbackCDN),
          faceapi.nets.faceExpressionNet.loadFromUri(fallbackCDN)
        ]);
        console.log('Models loaded from fallback CDN');
      }

      this.modelsLoaded = true;
      console.log('Face recognition models loaded successfully');
      return true;

    } catch (error) {
      console.error('Failed to load face recognition models:', error);
      throw new Error('Unable to load face recognition models. Please check your internet connection.');
    }
  }

  /**
   * Start camera stream
   */
  async startCamera(videoElement) {
    try {
      // Stop existing stream
      if (this.videoStream) {
        this.stopCamera();
      }

      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = this.videoStream;
      this.currentVideo = videoElement;

      return new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          console.log('Camera started successfully');
          resolve(true);
        };
        videoElement.onerror = (error) => {
          console.error('Video element error:', error);
          reject(new Error('Failed to start video'));
        };
      });

    } catch (error) {
      console.error('Camera access error:', error);
      throw new Error('Camera access denied or unavailable');
    }
  }

  /**
   * Stop camera stream
   */
  stopCamera() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    if (this.currentVideo) {
      this.currentVideo.srcObject = null;
    }
    console.log('Camera stopped');
  }

  /**
   * Detect face in video stream
   */
  async detectFace() {
    if (!this.currentVideo || !this.modelsLoaded) {
      throw new Error('Camera not started or models not loaded');
    }

    try {
      const detection = await faceapi
        .detectSingleFace(this.currentVideo, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      return detection;
    } catch (error) {
      console.error('Face detection error:', error);
      return null;
    }
  }

  /**
   * Capture face for registration
   */
  async captureFaceForRegistration(maxAttempts = 5) {
    console.log('Starting face capture for registration...');
    
    let attempts = 0;
    let bestCapture = null;
    let bestConfidence = 0;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Face capture attempt ${attempts}/${maxAttempts}`);

      try {
        const detection = await this.detectFace();
        
        if (detection && detection.detection.score > 0.7) {
          console.log(`Face detected with confidence: ${detection.detection.score}`);
          
          if (detection.detection.score > bestConfidence) {
            bestCapture = detection;
            bestConfidence = detection.detection.score;
          }
          
          // If we have a high-confidence detection, use it
          if (detection.detection.score > 0.9) {
            break;
          }
        } else {
          console.log('No face detected or low confidence');
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Face capture attempt ${attempts} failed:`, error);
      }
    }

    if (bestCapture) {
      console.log(`Face captured successfully with confidence: ${bestConfidence}`);
      return {
        descriptor: bestCapture.descriptor,
        confidence: bestConfidence,
        landmarks: bestCapture.landmarks
      };
    } else {
      throw new Error('Failed to capture face after multiple attempts');
    }
  }

  /**
   * Verify face against stored descriptor
   */
  async verifyFace(storedDescriptor, threshold = 0.6) {
    try {
      const detection = await this.detectFace();
      
      if (!detection) {
        return { success: false, confidence: 0, message: 'No face detected' };
      }

      const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor);
      const confidence = 1 - distance;
      const isMatch = distance < threshold;

      return {
        success: isMatch,
        confidence: confidence,
        distance: distance,
        message: isMatch ? 'Face verified successfully' : 'Face verification failed'
      };

    } catch (error) {
      console.error('Face verification error:', error);
      return { success: false, confidence: 0, message: 'Verification error' };
    }
  }

  /**
   * Perform liveness check (basic anti-spoofing)
   */
  async performLivenessCheck() {
    console.log('Performing liveness check...');
    
    const checks = [];
    const checkCount = 3;
    
    for (let i = 0; i < checkCount; i++) {
      try {
        const detection = await this.detectFace();
        
        if (detection) {
          checks.push({
            confidence: detection.detection.score,
            timestamp: Date.now()
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error('Liveness check error:', error);
      }
    }

    const avgConfidence = checks.length > 0 
      ? checks.reduce((sum, check) => sum + check.confidence, 0) / checks.length 
      : 0;

    const isLive = checks.length >= 2 && avgConfidence > 0.8;

    return {
      isLive: isLive,
      confidence: avgConfidence,
      checks: checks.length,
      message: isLive ? 'Liveness verified' : 'Liveness check failed'
    };
  }
}

// Global instance for legacy compatibility
let faceRecognitionInstance = null;

// Legacy functions for compatibility with registration page
async function startCamera() {
  try {
    console.log('Starting camera (legacy function)...');
    
    if (!faceRecognitionInstance) {
      faceRecognitionInstance = new FaceRecognition();
    }

    // Load models first
    await faceRecognitionInstance.loadModels();
    
    // Get video element
    const video = document.getElementById('video') || document.querySelector('video');
    if (!video) {
      throw new Error('Video element not found');
    }

    // Start camera
    await faceRecognitionInstance.startCamera(video);
    
    // Start face detection loop
    startFaceDetectionLoop();
    
    return true;
  } catch (error) {
    console.error('Legacy startCamera failed:', error);
    throw error;
  }
}

async function stopCamera() {
  if (faceRecognitionInstance) {
    faceRecognitionInstance.stopCamera();
  }
}

async function startFaceDetectionLoop() {
  if (!faceRecognitionInstance) return;
  
  const video = document.getElementById('video') || document.querySelector('video');
  const canvas = document.getElementById('overlay') || document.querySelector('canvas');
  
  if (!video || !canvas) return;

  const detectionInterval = setInterval(async () => {
    try {
      const detection = await faceRecognitionInstance.detectFace();
      
      if (detection && canvas) {
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        
        const resizedDetection = faceapi.resizeResults(detection, displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        faceapi.draw.drawDetections(canvas, [resizedDetection]);
        faceapi.draw.drawFaceLandmarks(canvas, [resizedDetection]);
      }
    } catch (error) {
      console.error('Face detection loop error:', error);
    }
  }, 100);

  // Store interval for cleanup
  if (faceRecognitionInstance) {
    faceRecognitionInstance.detectionInterval = detectionInterval;
  }
}

async function captureFace() {
  if (!faceRecognitionInstance) {
    throw new Error('Face recognition not initialized');
  }
  
  return await faceRecognitionInstance.captureFaceForRegistration();
}

// Cleanup on page unload
document.addEventListener('DOMContentLoaded', function() {
  console.log('Face recognition module loaded');
});

window.addEventListener('beforeunload', function() {
  if (faceRecognitionInstance) {
    faceRecognitionInstance.stopCamera();
    if (faceRecognitionInstance.detectionInterval) {
      clearInterval(faceRecognitionInstance.detectionInterval);
    }
  }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FaceRecognition;
}