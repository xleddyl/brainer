#include "llama_model.h"
#include "llama_context.h"
#include "llama_embedder.h"

Napi::FunctionReference LlamaModel::constructor_;

class LoadModelWorker : public Napi::AsyncWorker {
public:
  LoadModelWorker(Napi::Env env, LlamaModel* wrapper, std::string path, int gpu_layers)
    : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)),
      wrapper_(wrapper), path_(std::move(path)), gpu_layers_(gpu_layers) {}

  Napi::Promise Promise() { return deferred_.Promise(); }

  void Execute() override {
    auto params = llama_model_default_params();
    params.n_gpu_layers = gpu_layers_;
    model_ = llama_model_load_from_file(path_.c_str(), params);
    if (!model_) {
      SetError("Failed to load model: " + path_);
    }
  }

  void OnOK() override {
    wrapper_->model_ = model_;
    deferred_.Resolve(Env().Undefined());
  }

  void OnError(const Napi::Error& err) override {
    deferred_.Reject(err.Value());
  }

private:
  Napi::Promise::Deferred deferred_;
  LlamaModel* wrapper_;
  std::string path_;
  int gpu_layers_;
  llama_model* model_ = nullptr;

  friend class LlamaModel;
};

Napi::Function LlamaModel::Init(Napi::Env env) {
  auto func = DefineClass(env, "LlamaModel", {
    InstanceMethod("load", &LlamaModel::Load),
    InstanceMethod("createContext", &LlamaModel::CreateContext),
    InstanceMethod("createEmbedder", &LlamaModel::CreateEmbedder),
    InstanceMethod("embeddingDimensions", &LlamaModel::EmbeddingDimensions),
    InstanceMethod("dispose", &LlamaModel::Dispose),
  });
  constructor_ = Napi::Persistent(func);
  constructor_.SuppressDestruct();
  return func;
}

LlamaModel::LlamaModel(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<LlamaModel>(info) {}

LlamaModel::~LlamaModel() {
  if (model_) {
    llama_model_free(model_);
    model_ = nullptr;
  }
}

Napi::Value LlamaModel::Load(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto opts = info[0].As<Napi::Object>();
  auto path = opts.Get("modelPath").As<Napi::String>().Utf8Value();
  int gpu_layers = opts.Has("gpuLayers")
    ? opts.Get("gpuLayers").As<Napi::Number>().Int32Value()
    : 99;

  auto worker = new LoadModelWorker(env, this, path, gpu_layers);
  auto promise = worker->Promise();
  worker->Queue();
  return promise;
}

Napi::Value LlamaModel::CreateContext(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (!model_) {
    Napi::Error::New(env, "Model not loaded").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  auto opts = info[0].As<Napi::Object>();
  int ctx_size = opts.Has("contextSize")
    ? opts.Get("contextSize").As<Napi::Number>().Int32Value()
    : 8192;
  return LlamaContext::Create(env, model_, ctx_size);
}

Napi::Value LlamaModel::CreateEmbedder(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (!model_) {
    Napi::Error::New(env, "Model not loaded").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  return LlamaEmbedder::Create(env, model_);
}

Napi::Value LlamaModel::EmbeddingDimensions(const Napi::CallbackInfo& info) {
  if (!model_) return info.Env().Undefined();
  return Napi::Number::New(info.Env(), llama_model_n_embd(model_));
}

Napi::Value LlamaModel::Dispose(const Napi::CallbackInfo& info) {
  if (model_) {
    llama_model_free(model_);
    model_ = nullptr;
  }
  return info.Env().Undefined();
}
