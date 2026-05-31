// Objective-C example — Code Scavenge test file
#import <Foundation/Foundation.h>
#import <math.h>

// ── C-style utility functions ─────────────────────────────────

float clamp(float value, float lo, float hi) {
    return fmaxf(lo, fminf(hi, value));
}

float lerp(float a, float b, float t) {
    return a + (b - a) * t;
}

// ── Protocol (interface) ──────────────────────────────────────

@protocol Drawable <NSObject>
- (void)draw;
- (CGRect)bounds;
@end

@protocol Serializable
+ (instancetype)fromDictionary:(NSDictionary *)dict;
- (NSDictionary *)toDictionary;
@end

// ── Interface (class declaration) ─────────────────────────────

@interface Vec2 : NSObject

@property (nonatomic) float x;
@property (nonatomic) float y;

+ (instancetype)vec2WithX:(float)x y:(float)y;
- (instancetype)initWithX:(float)x y:(float)y;
- (Vec2 *)addVec:(Vec2 *)other;
- (Vec2 *)scaleBy:(float)s;
- (float)dot:(Vec2 *)other;
- (float)length;

@end

// ── Implementation ────────────────────────────────────────────

@implementation Vec2

+ (instancetype)vec2WithX:(float)x y:(float)y {
    return [[self alloc] initWithX:x y:y];
}

- (instancetype)initWithX:(float)x y:(float)y {
    if (self = [super init]) { _x = x; _y = y; }
    return self;
}

- (Vec2 *)addVec:(Vec2 *)other {
    return [Vec2 vec2WithX:_x + other.x y:_y + other.y];
}

- (Vec2 *)scaleBy:(float)s {
    return [Vec2 vec2WithX:_x * s y:_y * s];
}

- (float)dot:(Vec2 *)other {
    return _x * other.x + _y * other.y;
}

- (float)length {
    return sqrtf(_x * _x + _y * _y);
}

@end

@interface Circle : NSObject <Drawable>
@property (nonatomic) Vec2 *center;
@property (nonatomic) float radius;
+ (instancetype)circleAt:(Vec2 *)center radius:(float)radius;
- (float)area;
@end

@implementation Circle

+ (instancetype)circleAt:(Vec2 *)center radius:(float)radius {
    Circle *c = [self new]; c.center = center; c.radius = radius; return c;
}

- (float)area { return M_PI * _radius * _radius; }
- (void)draw  { NSLog(@"Circle at (%f,%f) r=%f", _center.x, _center.y, _radius); }
- (CGRect)bounds { return CGRectMake(_center.x - _radius, _center.y - _radius, _radius*2, _radius*2); }

@end
