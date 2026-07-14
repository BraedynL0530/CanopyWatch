import torch.nn as nn

class forestClassifier(nn.Module):
    def __init__(self):
        super(forestClassifier, self).__init__()
        self.encoder = nn.Conv2d(4, 64, kernel_size=3,  padding=1)
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2)

        self.bottleneckConv = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.upsample = nn.ConvTranspose2d(128,64,kernel_size=2,stride=2)

        self.finalConv = nn.Conv2d(64,1,kernel_size=1)

        self.relu = nn.ReLU()
    def forward(self, x):
        x1 = self.relu(self.encoder(x))
        x2 = self.pool(x1)
        b=self.relu(self.bottleneckConv(x2))
        u=self.relu(self.upsample(b))
        out = self.finalConv(u)
        return out

